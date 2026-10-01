import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Namespace, Socket } from 'socket.io';

import type { AccessTokenVerifierService } from '../auth/access-token-verifier.service.js';
import type { TenantContextService } from '../tenancy/tenant-context.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import type { UsersService } from '../users/users.service.js';
import { RealtimeGateway } from './realtime.gateway.js';
import type { AuthenticatedSocket, RealtimeSocketData } from './realtime.types.js';

describe('RealtimeGateway', () => {
  const USER_A = '11111111-1111-4111-8111-111111111111';
  const ORG_A = '22222222-2222-4222-8222-222222222222';
  const MEMBERSHIP_A = '33333333-3333-4333-8333-333333333333';
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
});
