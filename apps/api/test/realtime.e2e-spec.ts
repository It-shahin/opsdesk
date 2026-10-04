import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { io, type Socket as ClientSocket } from 'socket.io-client';

import { AccessTokenVerifierService } from '../src/auth/access-token-verifier.service.js';
import { PermissionsService } from '../src/rbac/permissions.service.js';
import { RedisModule } from '../src/redis/redis.module.js';
import { RealtimePublisherModule } from '../src/realtime/realtime-publisher.module.js';
import { RealtimeRedisAdapterService } from '../src/realtime/realtime-redis-adapter.service.js';
import { RealtimeGateway } from '../src/realtime/realtime.gateway.js';
import { RealtimeService } from '../src/realtime/realtime.service.js';
import type {
  ClientToServerEvents,
  EmailDeliveryUpdatedRealtimePayload,
  ServerToClientEvents,
  TicketCreatedRealtimePayload,
} from '../src/realtime/realtime.types.js';
import { SocketIoAdapter } from '../src/realtime/socket-io.adapter.js';
import { TenantContextService } from '../src/tenancy/tenant-context.service.js';
import { TicketsService } from '../src/tickets/tickets.service.js';
import { UsersService } from '../src/users/users.service.js';

type RealtimeClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;
type ConnectionError = Error & { data?: { code: string } };

describe('Realtime (e2e)', () => {
  const USER_A = '11111111-1111-4111-8111-111111111111';
  const USER_B = '22222222-2222-4222-8222-222222222222';
  const ORG_A = '33333333-3333-4333-8333-333333333333';
  const ORG_B = '44444444-4444-4444-8444-444444444444';
  const MEMBERSHIP_A = '55555555-5555-4555-8555-555555555555';
  const MEMBERSHIP_B = '66666666-6666-4666-8666-666666666666';
  const TICKET_A = '77777777-7777-4777-8777-777777777777';
  const TICKET_B = '88888888-8888-4888-8888-888888888888';
  const MESSAGE_A = '99999999-9999-4999-8999-999999999999';
  const DELIVERY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const TIMEOUT_MS = 2_000;

  let app: INestApplication | undefined;
  let baseUrl: string;
  let realtime: RealtimeService;
  const clients: RealtimeClient[] = [];
  let membershipAActive = true;
  let canReadTickets = true;

  const accessTokenVerifier = {
    verify: async (token: string) => {
      if (token === 'token-a') {
        return { sub: 'auth0|user-a' };
      }
      if (token === 'token-b') {
        return { sub: 'auth0|user-b' };
      }
      throw new UnauthorizedException('Invalid access token');
    },
  };

  const usersService = {
    syncAuthenticatedUser: async (session: { accessToken: string }) => ({
      id: session.accessToken === 'token-a' ? USER_A : USER_B,
    }),
  };

  const tenantContext = {
    resolve: async (userId: string, organizationId: string) => {
      if (userId === USER_A && organizationId === ORG_A && membershipAActive) {
        return {
          userId: USER_A,
          organizationId: ORG_A,
          membershipId: MEMBERSHIP_A,
          role: 'AGENT' as const,
        };
      }
      if (userId === USER_B && organizationId === ORG_B) {
        return {
          userId: USER_B,
          organizationId: ORG_B,
          membershipId: MEMBERSHIP_B,
          role: 'AGENT' as const,
        };
      }
      return null;
    },
  };

  const permissions = {
    hasPermission: () => canReadTickets,
  };

  const ticketsService = {
    existsInOrganization: async (organizationId: string, ticketId: string) =>
      (organizationId === ORG_A && ticketId === TICKET_A) ||
      (organizationId === ORG_B && ticketId === TICKET_B),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
            }),
          ],
        }),
        RedisModule,
        RealtimePublisherModule,
      ],
      providers: [
        RealtimeGateway,
        RealtimeRedisAdapterService,
        { provide: AccessTokenVerifierService, useValue: accessTokenVerifier },
        { provide: UsersService, useValue: usersService },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: PermissionsService, useValue: permissions },
        { provide: TicketsService, useValue: ticketsService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    const redisAdapter = app.get(RealtimeRedisAdapterService);
    await redisAdapter.connect();
    app.useWebSocketAdapter(
      new SocketIoAdapter(
        app,
        'http://localhost:3000',
        redisAdapter.getAdapter(),
      ),
    );
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    realtime = app.get(RealtimeService);
  }, 15_000);

  afterEach(() => {
    for (const client of clients) {
      client.removeAllListeners();
      client.disconnect();
    }
    clients.length = 0;
    membershipAActive = true;
    canReadTickets = true;
  });

  afterAll(async () => {
    await app?.close();
  });

  function createClient(token?: string): RealtimeClient {
    const client: RealtimeClient = io(`${baseUrl}/realtime`, {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: false,
      timeout: TIMEOUT_MS,
      auth: token ? { token } : {},
    });
    clients.push(client);
    return client;
  }

  function connectClient(token: string): Promise<RealtimeClient> {
    const client = createClient(token);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        client.off('realtime.ready', onReady);
        client.off('connect_error', onError);
      };
      const onReady = () => {
        cleanup();
        resolve(client);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Realtime connection timed out'));
      }, TIMEOUT_MS);
      client.once('realtime.ready', onReady);
      client.once('connect_error', onError);
      client.connect();
    });
  }

  // Subscribe before publishing; remove the listener on both receipt and timeout.
  function waitForPayload<T>(
    event: string,
    subscribe: (listener: (payload: T) => void) => () => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`${event} was not received`));
      }, TIMEOUT_MS);
      const unsubscribe = subscribe((payload) => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });
  }

  function ticketCreated(client: RealtimeClient) {
    return waitForPayload<TicketCreatedRealtimePayload>(
      'ticket.created',
      (listener) => {
        client.once('ticket.created', listener);
        return () => client.off('ticket.created', listener);
      },
    );
  }

  function deliveryUpdated(client: RealtimeClient) {
    return waitForPayload<EmailDeliveryUpdatedRealtimePayload>(
      'email.delivery.updated',
      (listener) => {
        client.once('email.delivery.updated', listener);
        return () => client.off('email.delivery.updated', listener);
      },
    );
  }

  function connectionError(client: RealtimeClient) {
    const result = waitForPayload<ConnectionError>(
      'connect_error',
      (listener) => {
        client.once('connect_error', listener);
        return () => client.off('connect_error', listener);
      },
    );
    client.connect();
    return result;
  }

  function joinOrganization(client: RealtimeClient, organizationId: string) {
    return client
      .timeout(TIMEOUT_MS)
      .emitWithAck('organization.join', { organizationId });
  }

  function joinTicket(
    client: RealtimeClient,
    organizationId: string,
    ticketId: string,
  ) {
    return client
      .timeout(TIMEOUT_MS)
      .emitWithAck('ticket.join', { organizationId, ticketId });
  }

  function leaveOrganization(client: RealtimeClient, organizationId: string) {
    return client
      .timeout(TIMEOUT_MS)
      .emitWithAck('organization.leave', { organizationId });
  }

  function wait(milliseconds: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }

  function publishDeliveryUpdated() {
    return realtime.publishEmailDeliveryUpdated({
      organizationId: ORG_A,
      ticketId: TICKET_A,
      messageId: MESSAGE_A,
      emailDeliveryId: DELIVERY_A,
      status: 'DELIVERED',
    });
  }

  it('rejects a socket with no access token', async () => {
    const client = createClient();
    const error = await connectionError(client);
    expect(error.data).toEqual({ code: 'MISSING_ACCESS_TOKEN' });
    expect(client.connected).toBe(false);
  });

  it('rejects an invalid access token', async () => {
    const client = createClient('evil-token');
    const error = await connectionError(client);
    expect(error.data).toEqual({ code: 'INVALID_ACCESS_TOKEN' });
    expect(client.connected).toBe(false);
  });

  it('accepts an authenticated socket and emits realtime.ready', async () => {
    // connectClient resolves only after realtime.ready, rather than transport connect.
    const client = await connectClient('token-a');
    expect(client.connected).toBe(true);
  });

  it('allows joining only organizations belonging to the authenticated user', async () => {
    const client = await connectClient('token-a');
    expect(await joinOrganization(client, ORG_A)).toEqual({
      ok: true,
      organization: {
        organizationId: ORG_A,
        membershipId: MEMBERSHIP_A,
        role: 'AGENT',
      },
    });
    expect(await joinOrganization(client, ORG_B)).toEqual({
      ok: false,
      error: {
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      },
    });
  });

  it('does not reveal or join a ticket from another tenant', async () => {
    const client = await connectClient('token-a');
    expect((await joinOrganization(client, ORG_A)).ok).toBe(true);
    expect(await joinTicket(client, ORG_A, TICKET_B)).toEqual({
      ok: false,
      error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' },
    });
  });

  it('rejects a ticket room request without ticket read permission', async () => {
    const client = await connectClient('token-a');
    expect((await joinOrganization(client, ORG_A)).ok).toBe(true);
    canReadTickets = false;
    expect(await joinTicket(client, ORG_A, TICKET_A)).toEqual({
      ok: false,
      error: { code: 'TICKET_ACCESS_DENIED', message: 'Ticket access denied' },
    });
  });

  it('delivers Redis-published organization events to an authorized client', async () => {
    const client = await connectClient('token-a');
    expect((await joinOrganization(client, ORG_A)).ok).toBe(true);
    const received = ticketCreated(client);
    const published = realtime.publishTicketCreated({
      organizationId: ORG_A,
      ticketId: TICKET_A,
    });
    expect(await received).toEqual({
      organizationId: ORG_A,
      ticketId: TICKET_A,
      occurredAt: expect.any(String),
    });
    expect(published).toBe(true);
  });

  it('does not leak organization events across tenants', async () => {
    const clientA = await connectClient('token-a');
    const clientB = await connectClient('token-b');
    expect((await joinOrganization(clientA, ORG_A)).ok).toBe(true);
    expect((await joinOrganization(clientB, ORG_B)).ok).toBe(true);
    const leaked = jest.fn();
    clientB.on('ticket.created', leaked);
    const received = ticketCreated(clientA);
    realtime.publishTicketCreated({
      organizationId: ORG_A,
      ticketId: TICKET_A,
    });
    await received;
    await wait(300);
    expect(leaked).not.toHaveBeenCalled();
  });

  it('sends ticket-only events only to sockets joined to that ticket', async () => {
    const detailClient = await connectClient('token-a');
    const inboxClient = await connectClient('token-a');
    expect((await joinOrganization(detailClient, ORG_A)).ok).toBe(true);
    expect((await joinOrganization(inboxClient, ORG_A)).ok).toBe(true);
    expect((await joinTicket(detailClient, ORG_A, TICKET_A)).ok).toBe(true);
    const leaked = jest.fn();
    inboxClient.on('email.delivery.updated', leaked);
    const received = deliveryUpdated(detailClient);
    publishDeliveryUpdated();
    expect(await received).toEqual({
      organizationId: ORG_A,
      ticketId: TICKET_A,
      messageId: MESSAGE_A,
      emailDeliveryId: DELIVERY_A,
      status: 'DELIVERED',
      occurredAt: expect.any(String),
    });
    await wait(300);
    expect(leaked).not.toHaveBeenCalled();
  });

  it('removes ticket subscriptions when leaving the parent organization', async () => {
    const client = await connectClient('token-a');
    const observer = await connectClient('token-a');
    for (const socket of [client, observer]) {
      expect((await joinOrganization(socket, ORG_A)).ok).toBe(true);
      expect((await joinTicket(socket, ORG_A, TICKET_A)).ok).toBe(true);
    }
    expect(await leaveOrganization(client, ORG_A)).toEqual({ ok: true });
    const orgLeak = jest.fn();
    const ticketLeak = jest.fn();
    client.on('ticket.created', orgLeak);
    client.on('email.delivery.updated', ticketLeak);
    // An observer confirms both publications reached Redis and the actual adapter.
    const received = Promise.all([
      ticketCreated(observer),
      deliveryUpdated(observer),
    ]);
    realtime.publishTicketCreated({
      organizationId: ORG_A,
      ticketId: TICKET_A,
    });
    publishDeliveryUpdated();
    await received;
    await wait(400);
    expect(orgLeak).not.toHaveBeenCalled();
    expect(ticketLeak).not.toHaveBeenCalled();
  });

  it('revokes cached organization and ticket access when membership disappears', async () => {
    const client = await connectClient('token-a');
    expect((await joinOrganization(client, ORG_A)).ok).toBe(true);
    expect((await joinTicket(client, ORG_A, TICKET_A)).ok).toBe(true);
    membershipAActive = false;
    // Revocation takes effect on revalidation. An idle socket is not proactively evicted.
    expect(await joinTicket(client, ORG_A, TICKET_A)).toEqual({
      ok: false,
      error: {
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      },
    });
    const orgLeak = jest.fn();
    const ticketLeak = jest.fn();
    client.on('ticket.created', orgLeak);
    client.on('email.delivery.updated', ticketLeak);
    expect(
      realtime.publishTicketCreated({
        organizationId: ORG_A,
        ticketId: TICKET_A,
      }),
    ).toBe(true);
    expect(publishDeliveryUpdated()).toBe(true);
    await wait(400);
    expect(orgLeak).not.toHaveBeenCalled();
    expect(ticketLeak).not.toHaveBeenCalled();
  });
});
