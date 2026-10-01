import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Namespace, Socket } from 'socket.io';

import type { AccessTokenVerifierService } from '../auth/access-token-verifier.service.js';
import type { TenantContextService } from '../tenancy/tenant-context.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import type { UsersService } from '../users/users.service.js';
import type { PermissionsService } from '../rbac/permissions.service.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import type { TicketsService } from '../tickets/tickets.service.js';
import { RealtimeGateway } from './realtime.gateway.js';
import type { AuthenticatedSocket, RealtimeSocketData } from './realtime.types.js';

describe('RealtimeGateway', () => {
  const USER_A = '11111111-1111-4111-8111-111111111111';
  const ORG_A = '22222222-2222-4222-8222-222222222222';
  const MEMBERSHIP_A = '33333333-3333-4333-8333-333333333333';
  const ORG_B = '44444444-4444-4444-8444-444444444444';
  const TICKET_A = '55555555-5555-4555-8555-555555555555';
  const TICKET_A2 = '66666666-6666-4666-8666-666666666666';
  const TICKET_B = '77777777-7777-4777-8777-777777777777';
  const tenant: TenantContext = {
    userId: USER_A,
    organizationId: ORG_A,
    membershipId: MEMBERSHIP_A,
    role: 'AGENT',
  };
  const verifyMock = jest.fn<AccessTokenVerifierService['verify']>();
  const syncAuthenticatedUserMock = jest.fn<
    (session: Parameters<UsersService['syncAuthenticatedUser']>[0]) =>
      Promise<{ id: string }>
  >();
  const resolveTenantMock = jest.fn<TenantContextService['resolve']>();
  const hasPermissionMock = jest.fn<PermissionsService['hasPermission']>();
  const ticketExistsMock = jest.fn<TicketsService['existsInOrganization']>();
  const permissions = { hasPermission: hasPermissionMock };
  const ticketsService = { existsInOrganization: ticketExistsMock };
  const usersService = { syncAuthenticatedUser: syncAuthenticatedUserMock };
  const tenantContext = { resolve: resolveTenantMock };
  const useMock = jest.fn<Namespace['use']>();
  let gateway: RealtimeGateway;
  let middleware: Parameters<Namespace['use']>[0];

  beforeEach(() => {
    jest.resetAllMocks();

    gateway = new RealtimeGateway(
      { verify: verifyMock } as unknown as AccessTokenVerifierService,
      usersService as unknown as UsersService,
      tenantContext as unknown as TenantContextService,
      permissions as unknown as PermissionsService,
      ticketsService as unknown as TicketsService,
    );

    gateway.afterInit({ use: useMock } as unknown as Namespace);
    middleware = useMock.mock.calls[0]![0];
  });

  function createSocket(token?: string) {
    return {
      id: 'socket-1',
      handshake: { auth: token === undefined ? {} : { token } },
      data: {} as Partial<RealtimeSocketData>,
      emit: jest.fn(),
      join: jest.fn<AuthenticatedSocket['join']>(),
      leave: jest.fn<AuthenticatedSocket['leave']>(),
    };
  }

  function createAuthenticatedSocket() {
    return {
      ...createSocket(),
      data: {
        auth: { sub: 'auth0|user-1' },
        userId: USER_A,
        tenants: {} as Record<string, TenantContext>,
        tickets: {} as RealtimeSocketData['tickets'],
      },
    };
  }

  it('rejects connections without an access token', async () => {
    const socket = createSocket();
    const next = jest.fn<Parameters<typeof middleware>[1]>();

    await middleware(socket as unknown as Socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Authentication required',
        data: { code: 'MISSING_ACCESS_TOKEN' },
      }),
    );
    expect(verifyMock).not.toHaveBeenCalled();
    expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(socket.data.auth).toBeUndefined();
  });

  it('rejects connections with an invalid access token', async () => {
    verifyMock.mockRejectedValue(
      new UnauthorizedException('Invalid access token'),
    );
    const socket = createSocket('invalid-token');
    const next = jest.fn<Parameters<typeof middleware>[1]>();

    await middleware(socket as unknown as Socket, next);

    expect(verifyMock).toHaveBeenCalledWith('invalid-token');
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Authentication failed',
        data: { code: 'INVALID_ACCESS_TOKEN' },
      }),
    );
    expect(socket.data.auth).toBeUndefined();
  });

  it('verifies valid tokens, synchronizes the user, and stores authentication data', async () => {
    const principal = { sub: 'auth0|user-1' };
    verifyMock.mockResolvedValue(principal);
    syncAuthenticatedUserMock.mockResolvedValue({ id: USER_A });
    const socket = createSocket('valid-token');
    const next = jest.fn<Parameters<typeof middleware>[1]>();

    await middleware(socket as unknown as Socket, next);

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith('valid-token');
    expect(socket.data.auth).toEqual(
      expect.objectContaining({ sub: 'auth0|user-1' }),
    );
    expect(syncAuthenticatedUserMock).toHaveBeenCalledTimes(1);
    expect(syncAuthenticatedUserMock).toHaveBeenCalledWith({
      auth: expect.objectContaining({ sub: 'auth0|user-1' }),
      accessToken: 'valid-token',
    });
    expect(socket.data.userId).toBe(USER_A);
    expect(socket.data.tenants).toEqual({});
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('emits realtime.ready on connection', async () => {
    const socket = createAuthenticatedSocket();

    await gateway.handleConnection(socket as unknown as AuthenticatedSocket);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('realtime.ready', {
      connectedAt: expect.any(String),
    });
  });

  it('joins the authenticated user private room on connection', async () => {
    const socket = createAuthenticatedSocket();

    await gateway.handleConnection(socket as unknown as AuthenticatedSocket);

    expect(socket.join).toHaveBeenCalledTimes(1);
    expect(socket.join).toHaveBeenCalledWith(`user:${USER_A}`);
  });

  it('joins an authorized organization and stores its tenant context', async () => {
    resolveTenantMock.mockResolvedValue(tenant);
    const socket = createAuthenticatedSocket();

    const result = await gateway.joinOrganization(
      socket as unknown as AuthenticatedSocket,
      { organizationId: ORG_A },
    );

    expect(resolveTenantMock).toHaveBeenCalledWith(USER_A, ORG_A);
    expect(socket.join).toHaveBeenCalledWith(`organization:${ORG_A}`);
    expect(socket.data.tenants[ORG_A]).toEqual(
      expect.objectContaining({ membershipId: MEMBERSHIP_A, role: 'AGENT' }),
    );
    const organization = {
      organizationId: ORG_A,
      membershipId: MEMBERSHIP_A,
      role: 'AGENT',
    };
    expect(result).toEqual({ ok: true, organization });
    expect(socket.emit).toHaveBeenCalledWith('organization.joined', organization);
  });

  it('rejects unauthorized organization joins without revealing existence', async () => {
    resolveTenantMock.mockResolvedValue(null);
    const socket = createAuthenticatedSocket();

    const result = await gateway.joinOrganization(
      socket as unknown as AuthenticatedSocket,
      { organizationId: ORG_A },
    );

    expect(resolveTenantMock).toHaveBeenCalledWith(USER_A, ORG_A);
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.data.tenants[ORG_A]).toBeUndefined();
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      },
    });
  });

  it('rejects invalid organization UUIDs without a tenant lookup', async () => {
    const socket = createAuthenticatedSocket();

    const result = await gateway.joinOrganization(
      socket as unknown as AuthenticatedSocket,
      { organizationId: 'hello' },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_ORGANIZATION_ID',
        message: 'Invalid organization ID',
      },
    });
    expect(resolveTenantMock).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('leaves an organization room and removes its tenant context', async () => {
    const socket = createAuthenticatedSocket();
    socket.data.tenants = { [ORG_A]: tenant };

    const result = await gateway.leaveOrganization(
      socket as unknown as AuthenticatedSocket,
      { organizationId: ORG_A },
    );

    expect(socket.leave).toHaveBeenCalledWith(`organization:${ORG_A}`);
    expect(socket.data.tenants[ORG_A]).toBeUndefined();
    expect(socket.emit).toHaveBeenCalledWith('organization.left', {
      organizationId: ORG_A,
    });
    expect(result).toEqual({ ok: true });
  });

  it('joins a ticket after checking fresh membership, permission, and tenant-scoped existence', async () => {
    const socket = createAuthenticatedSocket();
    socket.data.tenants[ORG_A] = { ...tenant, role: 'OWNER' };
    resolveTenantMock.mockResolvedValue(tenant);
    hasPermissionMock.mockReturnValue(true);
    ticketExistsMock.mockResolvedValue(true);
    const ticket = { organizationId: ORG_A, ticketId: TICKET_A };

    const result = await gateway.joinTicket(
      socket as unknown as AuthenticatedSocket,
      ticket,
    );

    expect(resolveTenantMock).toHaveBeenCalledWith(USER_A, ORG_A);
    expect(hasPermissionMock).toHaveBeenCalledWith('AGENT', PERMISSIONS.TICKETS_READ);
    expect(ticketExistsMock).toHaveBeenCalledWith(ORG_A, TICKET_A);
    expect(socket.join).toHaveBeenCalledTimes(1);
    expect(socket.join).toHaveBeenCalledWith(`ticket:${ORG_A}:${TICKET_A}`);
    expect(socket.data.tenants[ORG_A]).toEqual(tenant);
    expect(socket.data.tickets[TICKET_A]).toEqual(ticket);
    expect(socket.emit).toHaveBeenCalledWith('ticket.joined', ticket);
    expect(result).toEqual({ ok: true, ticket });
  });

  it('requires the organization to be joined before joining a ticket', async () => {
    const socket = createAuthenticatedSocket();

    const result = await gateway.joinTicket(
      socket as unknown as AuthenticatedSocket,
      { organizationId: ORG_A, ticketId: TICKET_A },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'ORGANIZATION_NOT_JOINED',
        message: 'Organization is not joined',
      },
    });
    expect(resolveTenantMock).not.toHaveBeenCalled();
    expect(hasPermissionMock).not.toHaveBeenCalled();
    expect(ticketExistsMock).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.data.tickets).toEqual({});
  });

  it('rejects ticket access denied by RBAC without querying the ticket', async () => {
    const socket = createAuthenticatedSocket();
    socket.data.tenants[ORG_A] = tenant;
    resolveTenantMock.mockResolvedValue(tenant);
    hasPermissionMock.mockReturnValue(false);

    const result = await gateway.joinTicket(
      socket as unknown as AuthenticatedSocket,
      { organizationId: ORG_A, ticketId: TICKET_A },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'TICKET_ACCESS_DENIED',
        message: 'Ticket access denied',
      },
    });
    expect(resolveTenantMock).toHaveBeenCalledWith(USER_A, ORG_A);
    expect(hasPermissionMock).toHaveBeenCalledWith('AGENT', PERMISSIONS.TICKETS_READ);
    expect(ticketExistsMock).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.data.tickets).toEqual({});
  });

  it('rejects a ticket from another organization without revealing its existence', async () => {
    const socket = createAuthenticatedSocket();
    socket.data.tenants[ORG_A] = tenant;
    resolveTenantMock.mockResolvedValue(tenant);
    hasPermissionMock.mockReturnValue(true);
    // The ticket belongs to ORG_B, so it cannot be found within ORG_A.
    ticketExistsMock.mockResolvedValue(false);

    const result = await gateway.joinTicket(
      socket as unknown as AuthenticatedSocket,
      { organizationId: ORG_A, ticketId: TICKET_B },
    );

    expect(ticketExistsMock).toHaveBeenCalledTimes(1);
    expect(ticketExistsMock).toHaveBeenCalledWith(ORG_A, TICKET_B);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket not found',
      },
    });
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.data.tickets).toEqual({});
  });

  it.each([
    {
      field: 'organization',
      payload: { organizationId: 'bad', ticketId: TICKET_A },
      code: 'INVALID_ORGANIZATION_ID',
      message: 'Invalid organization ID',
    },
    {
      field: 'ticket',
      payload: { organizationId: ORG_A, ticketId: 'bad' },
      code: 'INVALID_TICKET_ID',
      message: 'Invalid ticket ID',
    },
  ])('rejects invalid $field UUIDs before any lookup', async ({ payload, code, message }) => {
    const socket = createAuthenticatedSocket();
    socket.data.tenants[ORG_A] = tenant;

    const result = await gateway.joinTicket(
      socket as unknown as AuthenticatedSocket,
      payload,
    );

    expect(result).toEqual({ ok: false, error: { code, message } });
    expect(resolveTenantMock).not.toHaveBeenCalled();
    expect(hasPermissionMock).not.toHaveBeenCalled();
    expect(ticketExistsMock).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.data.tickets).toEqual({});
  });

  it('leaves a ticket room and removes its cached ticket context', async () => {
    const socket = createAuthenticatedSocket();
    const ticket = { organizationId: ORG_A, ticketId: TICKET_A };
    socket.data.tenants[ORG_A] = tenant;
    socket.data.tickets[TICKET_A] = ticket;

    const result = await gateway.leaveTicket(
      socket as unknown as AuthenticatedSocket,
      ticket,
    );

    expect(socket.leave).toHaveBeenCalledTimes(1);
    expect(socket.leave).toHaveBeenCalledWith(`ticket:${ORG_A}:${TICKET_A}`);
    expect(socket.data.tickets[TICKET_A]).toBeUndefined();
    expect(socket.data.tenants[ORG_A]).toEqual(tenant);
    expect(socket.emit).toHaveBeenCalledWith('ticket.left', ticket);
    expect(result).toEqual({ ok: true });
  });

  it.each(['organization leave', 'membership removal'] as const)(
    'cleans all affected ticket rooms before the organization room on %s',
    async (trigger) => {
      const socket = createAuthenticatedSocket();
      const otherTenant = { ...tenant, organizationId: ORG_B };
      const otherTicket = { organizationId: ORG_B, ticketId: TICKET_B };
      socket.data.tenants = { [ORG_A]: tenant, [ORG_B]: otherTenant };
      socket.data.tickets = {
        [TICKET_A]: { organizationId: ORG_A, ticketId: TICKET_A },
        [TICKET_B]: otherTicket,
        [TICKET_A2]: { organizationId: ORG_A, ticketId: TICKET_A2 },
      };
      socket.leave.mockResolvedValue(undefined);
      resolveTenantMock.mockResolvedValue(null);

      const client = socket as unknown as AuthenticatedSocket;
      const result = trigger === 'organization leave'
        ? await gateway.leaveOrganization(client, { organizationId: ORG_A })
        : await gateway.joinTicket(client, {
            organizationId: ORG_A,
            ticketId: TICKET_A,
          });

      expect(socket.leave.mock.calls).toEqual([
        [`ticket:${ORG_A}:${TICKET_A}`],
        [`ticket:${ORG_A}:${TICKET_A2}`],
        [`organization:${ORG_A}`],
      ]);
      expect(socket.data.tickets).toEqual({ [TICKET_B]: otherTicket });
      expect(socket.data.tenants).toEqual({ [ORG_B]: otherTenant });
      expect(socket.join).not.toHaveBeenCalled();
      expect(hasPermissionMock).not.toHaveBeenCalled();
      expect(ticketExistsMock).not.toHaveBeenCalled();

      if (trigger === 'organization leave') {
        expect(result).toEqual({ ok: true });
      } else {
        expect(resolveTenantMock).toHaveBeenCalledWith(USER_A, ORG_A);
        expect(socket.emit).not.toHaveBeenCalled();
        expect(result).toEqual({
          ok: false,
          error: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: 'Organization not found',
          },
        });
      }
    },
  );
});
