import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  Req,
  type RawBodyRequest,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createHmac, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { Resend } from 'resend';
import request from 'supertest';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';

import { AccessTokenVerifierService } from '../src/auth/access-token-verifier.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { Public } from '../src/auth/public.decorator.js';
import { RESEND_INBOUND_CLIENT } from '../src/email/email.constants.js';
import { InboundEmailService } from '../src/email/inbound-email.service.js';
import { OutboundEmailEventsService } from '../src/email/outbound-email-events.service.js';
import { ResendWebhookController } from '../src/email/resend-webhook.controller.js';
import { ResendWebhookVerificationService } from '../src/email/resend-webhook-verification.service.js';
import { configureHttpSecurity } from '../src/security/http-security.js';
import { SecurityModule } from '../src/security/security.module.js';
import { CreateTicketMessageDto } from '../src/tickets/dto/create-ticket-message.dto.js';
import { AuditService } from '../src/audit/audit.service.js';
import { CustomersController } from '../src/customers/customers.controller.js';
import { CustomersService } from '../src/customers/customers.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MembershipsService } from '../src/memberships/memberships.service.js';
import { OrganizationsController } from '../src/organizations/organizations.controller.js';
import { OrganizationsService } from '../src/organizations/organizations.service.js';
import { PermissionGuard } from '../src/rbac/permission.guard.js';
import { PermissionsService } from '../src/rbac/permissions.service.js';
import { RealtimeGateway } from '../src/realtime/realtime.gateway.js';
import { SocketIoAdapter } from '../src/realtime/socket-io.adapter.js';
import { TenantContextService } from '../src/tenancy/tenant-context.service.js';
import { TenantMembershipGuard } from '../src/tenancy/tenant-membership.guard.js';
import { TicketsService } from '../src/tickets/tickets.service.js';
import { UsersService } from '../src/users/users.service.js';

const transportHandler = jest.fn<() => void>();

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const UNKNOWN_ORG = '33333333-3333-4333-8333-333333333333';
const CUSTOMER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UNKNOWN_CUSTOMER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WEB_ORIGIN = 'https://opsdesk.example.test';

describe('Authenticated API and realtime security boundary', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  const clients: Socket[] = [];
  const previousRateLimitTests = process.env.RATE_LIMIT_TESTS;
  const createForUser = jest.fn<OrganizationsService['createForUser']>();
  const listForUser = jest.fn<OrganizationsService['listForUser']>();
  const findCustomer = jest.fn<PrismaService['customer']['findFirst']>();
  const verify = jest.fn<AccessTokenVerifierService['verify']>();
  const syncUser = jest.fn<UsersService['syncAuthenticatedUser']>();
  const findMembership =
    jest.fn<MembershipsService['findForUserAndOrganization']>();

  beforeAll(async () => {
    process.env.RATE_LIMIT_TESTS = '1';
    verify.mockImplementation(async (token) => {
      if (!token.startsWith('valid-'))
        throw new UnauthorizedException('Invalid access token');
      return { sub: `auth0|${token}` };
    });
    const now = new Date();
    syncUser.mockResolvedValue({
      id: USER_A,
      authProviderId: 'auth0|test',
      email: 'test@example.test',
      name: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    });
    createForUser.mockResolvedValue({
      id: ORG_A,
      name: 'Workspace',
      slug: 'workspace',
      role: 'OWNER',
      createdAt: now,
      updatedAt: now,
    });
    listForUser.mockResolvedValue([]);
    findMembership.mockImplementation(async (_userId, organizationId) =>
      organizationId === ORG_A
        ? {
            id: USER_A,
            organizationId: ORG_A,
            userId: USER_A,
            role: 'OWNER',
            createdAt: now,
            updatedAt: now,
            organization: {
              id: ORG_A,
              name: 'Workspace',
              slug: 'workspace',
              createdAt: now,
              updatedAt: now,
            },
          }
        : null,
    );
    findCustomer.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      imports: [SecurityModule],
      controllers: [OrganizationsController, CustomersController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        TenantMembershipGuard,
        TenantContextService,
        PermissionsService,
        PermissionGuard,
        CustomersService,
        RealtimeGateway,
        { provide: AccessTokenVerifierService, useValue: { verify } },
        {
          provide: UsersService,
          useValue: { syncAuthenticatedUser: syncUser },
        },
        {
          provide: MembershipsService,
          useValue: { findForUserAndOrganization: findMembership },
        },
        {
          provide: OrganizationsService,
          useValue: { createForUser, listForUser },
        },
        {
          provide: PrismaService,
          useValue: { customer: { findFirst: findCustomer } },
        },
        { provide: AuditService, useValue: { recordForTenant: jest.fn() } },
        { provide: TicketsService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      rawBody: true,
      logger: false,
    });
    configureHttpSecurity(app, false);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    // Transport security is independent of Redis pub/sub. Use Socket.IO's local
    // adapter here; the separate realtime suite exercises the real Redis adapter.
    const defaultServer = new Server();
    const localAdapter = defaultServer.of('/').adapter
      .constructor as unknown as ConstructorParameters<
      typeof SocketIoAdapter
    >[2];
    app.useWebSocketAdapter(
      new SocketIoAdapter(app, `${WEB_ORIGIN}/dashboard`, localAdapter),
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    for (const client of clients) {
      client.removeAllListeners();
      client.disconnect();
    }
    clients.length = 0;
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      if (previousRateLimitTests === undefined)
        delete process.env.RATE_LIMIT_TESTS;
      else process.env.RATE_LIMIT_TESTS = previousRateLimitTests;
    }
  });

  function create(token: string, extraHeaders: Record<string, string> = {}) {
    return request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .set(extraHeaders)
      .send({ name: 'Workspace' });
  }

  it('allows ordinary requests below the global limit', async () => {
    for (let i = 0; i < 6; i++) {
      const response = await request(app.getHttpServer())
        .get('/v1/organizations')
        .set('Authorization', 'Bearer valid-ordinary')
        .expect(200);
      expect(response.headers['x-ratelimit-limit']).toBe('240');
    }
    expect(listForUser).toHaveBeenCalledTimes(6);
  });

  it('returns 429 after five sensitive requests without executing the sixth mutation', async () => {
    for (let i = 0; i < 5; i++) await create('valid-sensitive').expect(201);
    const response = await create('valid-sensitive').expect(429);
    expect(response.headers['retry-after']).toBe('600');
    expect(createForUser).toHaveBeenCalledTimes(5);
  });

  it('keeps distinct bearer tokens in independent buckets even from the same client IP', async () => {
    for (const token of ['valid-bucket-a', 'valid-bucket-b']) {
      for (let i = 0; i < 5; i++) await create(token).expect(201);
      await create(token).expect(429);
    }
    expect(createForUser).toHaveBeenCalledTimes(10);
  });

  it('does not let spoofed forwarded IPs reset a bearer bucket and leaves trust proxy disabled', async () => {
    expect(app.getHttpAdapter().getInstance().get('trust proxy')).toBe(false);
    for (let i = 0; i < 5; i++)
      await create('valid-forwarded', {
        'X-Forwarded-For': `192.0.2.${i}`,
      }).expect(201);
    await create('valid-forwarded', {
      'X-Forwarded-For': '198.51.100.1',
    }).expect(429);
    expect(createForUser).toHaveBeenCalledTimes(5);
  });

  it('rejects oversized authenticated JSON before business processing', async () => {
    await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Authorization', 'Bearer valid-oversized')
      .send({ name: 'x'.repeat(64 * 1024) })
      .expect(413);
    expect(createForUser).not.toHaveBeenCalled();
  });

  it('rejects unknown DTO fields before business processing', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Authorization', 'Bearer valid-extra-fields')
      .send({ name: 'Workspace', isAdmin: true })
      .expect(400);
    expect(response.body.message).toContain(
      'property isAdmin should not exist',
    );
    expect(createForUser).not.toHaveBeenCalled();
  });

  it('keeps private endpoints authenticated by default', async () => {
    await request(app.getHttpServer()).get('/v1/organizations').expect(401);
    await request(app.getHttpServer())
      .get('/v1/organizations')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    expect(listForUser).not.toHaveBeenCalled();
  });

  it('returns the same generic not-found response for foreign and nonexistent organizations', async () => {
    const foreign = await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_B}`)
      .set('Authorization', 'Bearer valid-tenant')
      .expect(404);
    const absent = await request(app.getHttpServer())
      .get(`/v1/organizations/${UNKNOWN_ORG}`)
      .set('Authorization', 'Bearer valid-tenant')
      .expect(404);
    expect(foreign.body).toEqual(absent.body);
    expect(foreign.body.message).toBe('Organization not found');
  });

  it('scopes resource lookups to the authorized organization and hides foreign customer IDs', async () => {
    const foreign = await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_A}/customers/${CUSTOMER_B}`)
      .set('Authorization', 'Bearer valid-customer')
      .expect(404);
    const absent = await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_A}/customers/${UNKNOWN_CUSTOMER}`)
      .set('Authorization', 'Bearer valid-customer')
      .expect(404);
    expect(foreign.body).toEqual(absent.body);
    expect(findCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUSTOMER_B, organizationId: ORG_A },
      }),
    );
  });

  it('sets HTTP security headers without granting arbitrary origins authenticated API CORS access', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/organizations')
      .set('Authorization', 'Bearer valid-headers')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  function client(
    origin: string | null = WEB_ORIGIN,
    token = 'valid-realtime',
  ) {
    const socket = io(`${baseUrl}/realtime`, {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: false,
      timeout: 2000,
      auth: { token },
      extraHeaders: origin === null ? {} : { Origin: origin },
    });
    clients.push(socket);
    return socket;
  }

  function waitFor(socket: Socket, event: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off(event, received);
        reject(new Error(`Timed out waiting for ${event}`));
      }, 3000);
      function received(payload: unknown) {
        clearTimeout(timeout);
        resolve(payload);
      }
      socket.once(event, received);
    });
  }

  it('accepts a correct Origin and authenticated Socket.IO handshake', async () => {
    const socket = client();
    const ready = waitFor(socket, 'realtime.ready');
    socket.connect();
    await ready;
    expect(socket.connected).toBe(true);
  });

  it.each(['https://evil.example', `${WEB_ORIGIN}.evil.example`, 'null', null])(
    'rejects a Socket.IO handshake with origin %s',
    async (origin) => {
      const socket = client(origin);
      const error = waitFor(socket, 'connect_error');
      socket.connect();
      await error;
      expect(socket.connected).toBe(false);
    },
  );

  it('requires authentication even when the Socket.IO Origin is correct', async () => {
    const socket = client(WEB_ORIGIN, 'invalid-token');
    const error = waitFor(socket, 'connect_error');
    socket.connect();
    await error;
    expect(socket.connected).toBe(false);
  });

  it('disconnects oversized Socket.IO payloads at the transport boundary', async () => {
    const socket = client();
    const ready = waitFor(socket, 'realtime.ready');
    socket.connect();
    await ready;
    const disconnected = waitFor(socket, 'disconnect');
    socket.emit(
      'organization.join',
      { organizationId: 'x'.repeat(17 * 1024) },
      () => {},
    );
    await disconnected;
    expect(socket.connected).toBe(false);
  });
});

@Public()
@Controller('security-probe')
class SecurityProbeController {
  @Get()
  get() {
    return { ok: true };
  }

  @Post()
  @HttpCode(200)
  post(@Req() req: RawBodyRequest<Request>) {
    transportHandler();
    return { receivedBytes: req.rawBody?.length };
  }

  @Post('message')
  @HttpCode(200)
  message(@Body() dto: CreateTicketMessageDto) {
    return { length: dto.body.length };
  }
}

describe('HTTP headers, body limits and signed webhook security', () => {
  let app: NestExpressApplication;
  const previousRateLimitTests = process.env.RATE_LIMIT_TESTS;
  const signingKey = randomBytes(32);
  const webhookSecret = `whsec_${signingKey.toString('base64')}`;
  const outbound =
    jest.fn<(...args: unknown[]) => Promise<{ status: string }>>();
  const inbound =
    jest.fn<(...args: unknown[]) => Promise<{ status: string }>>();
  const authenticate = jest.fn<AccessTokenVerifierService['verify']>();

  async function createApp(isProduction: boolean) {
    const moduleRef = await Test.createTestingModule({
      imports: [SecurityModule],
      controllers: [SecurityProbeController, ResendWebhookController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        {
          provide: AccessTokenVerifierService,
          useValue: { verify: authenticate },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => webhookSecret },
        },
        {
          provide: RESEND_INBOUND_CLIENT,
          useValue: new Resend('re_local_test'),
        },
        ResendWebhookVerificationService,
        {
          provide: InboundEmailService,
          useValue: { handleReceivedEmail: inbound },
        },
        { provide: OutboundEmailEventsService, useValue: { handle: outbound } },
      ],
    }).compile();
    const application = moduleRef.createNestApplication<NestExpressApplication>(
      { rawBody: true, logger: false },
    );
    configureHttpSecurity(application, isProduction);
    application.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await application.init();
    return application;
  }

  function sign(payload: string, seconds = Math.floor(Date.now() / 1000)) {
    const id = 'msg_test';
    const timestamp = String(seconds);
    const signature = createHmac('sha256', signingKey)
      .update(`${id}.${timestamp}.${payload}`)
      .digest('base64');
    return {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    };
  }
  const payload =
    '{\n  "type": "email.delivered", "data": { "email_id": "email_1" }\n}\n';
  const webhook = (
    application: NestExpressApplication,
    body: string,
    headers: Record<string, string> = sign(body),
  ) =>
    request(application.getHttpServer())
      .post('/v1/webhooks/resend')
      .set('Content-Type', 'application/json')
      .set(headers)
      .send(body);

  beforeAll(async () => {
    process.env.RATE_LIMIT_TESTS = '1';
    app = await createApp(false);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    outbound.mockResolvedValue({ status: 'processed' });
    inbound.mockResolvedValue({ status: 'processed' });
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      if (previousRateLimitTests === undefined)
        delete process.env.RATE_LIMIT_TESTS;
      else process.env.RATE_LIMIT_TESTS = previousRateLimitTests;
    }
  });

  it('sets hardening headers without development HSTS, API CSP or HTTP CORS', async () => {
    const response = await request(app.getHttpServer())
      .get('/security-probe')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    for (const header of [
      'x-powered-by',
      'strict-transport-security',
      'content-security-policy',
      'access-control-allow-origin',
      'access-control-allow-credentials',
    ])
      expect(response.headers[header]).toBeUndefined();
  });

  it('sets production HSTS for one year without subdomain or preload directives', async () => {
    const production = await createApp(true);
    try {
      const response = await request(production.getHttpServer())
        .get('/security-probe')
        .expect(200);
      expect(response.headers['strict-transport-security']).toBe(
        'max-age=31536000',
      );
    } finally {
      await production.close();
    }
  });

  it('accepts JSON at 64 KiB and rejects larger JSON before controller processing', async () => {
    const json = (bytes: number) => `{"data":"${'x'.repeat(bytes - 11)}"}`;
    const response = await request(app.getHttpServer())
      .post('/security-probe')
      .set('Content-Type', 'application/json')
      .send(json(64 * 1024))
      .expect(200);
    expect(response.body.receivedBytes).toBe(64 * 1024);
    await request(app.getHttpServer())
      .post('/security-probe')
      .set('Content-Type', 'application/json')
      .send(json(64 * 1024 + 1))
      .expect(413);
    expect(transportHandler).toHaveBeenCalledTimes(1);
  });

  it('accepts URL-encoded bodies at 32 KiB and rejects larger bodies', async () => {
    const form = (bytes: number) => `data=${'x'.repeat(bytes - 5)}`;
    const response = await request(app.getHttpServer())
      .post('/security-probe')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(form(32 * 1024))
      .expect(200);
    expect(response.body.receivedBytes).toBe(32 * 1024);
    await request(app.getHttpServer())
      .post('/security-probe')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(form(32 * 1024 + 1))
      .expect(413);
    expect(transportHandler).toHaveBeenCalledTimes(1);
  });

  it('keeps the 20,000-character ticket-message DTO bound below the transport limit', async () => {
    await request(app.getHttpServer())
      .post('/security-probe/message')
      .send({ kind: 'PUBLIC_REPLY', body: 'x'.repeat(20_000) })
      .expect(200, { length: 20_000 });
    await request(app.getHttpServer())
      .post('/security-probe/message')
      .send({ kind: 'PUBLIC_REPLY', body: 'x'.repeat(20_001) })
      .expect(400);
  });

  it('cryptographically verifies the original raw JSON including whitespace without bearer authentication', async () => {
    const verify = jest.spyOn(
      app.get(ResendWebhookVerificationService),
      'verify',
    );
    try {
      await webhook(app, payload).expect(200, {
        received: true,
        result: 'processed',
      });
      expect(verify).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ id: 'msg_test' }),
      );
      expect(outbound).toHaveBeenCalledTimes(1);
      expect(authenticate).not.toHaveBeenCalled();
    } finally {
      verify.mockRestore();
    }
  });

  it('rejects tampering, missing signature headers and stale timestamps before business processing', async () => {
    await webhook(app, `${payload} `, sign(payload)).expect(400);
    await webhook(app, payload, {}).expect(400);
    const stale = sign(payload, Math.floor(Date.now() / 1000) - 3600);
    await webhook(app, payload, stale).expect(400);
    expect(outbound).not.toHaveBeenCalled();
    expect(inbound).not.toHaveBeenCalled();
  });

  it('rejects oversized signed webhook JSON before signature verification', async () => {
    const verify = jest.spyOn(
      app.get(ResendWebhookVerificationService),
      'verify',
    );
    try {
      await webhook(
        app,
        JSON.stringify({
          type: 'email.delivered',
          padding: 'x'.repeat(64 * 1024),
        }),
      ).expect(413);
      expect(verify).not.toHaveBeenCalled();
      expect(outbound).not.toHaveBeenCalled();
    } finally {
      verify.mockRestore();
    }
  });

  it('allows 600 signed webhook requests per minute and rejects request 601 before business processing', async () => {
    const isolated = await createApp(false);
    try {
      const headers = sign(payload);
      for (let index = 0; index < 600; index++) {
        const response = await webhook(isolated, payload, headers).expect(200);
        expect(response.headers['x-ratelimit-limit']).toBe('600');
      }
      const response = await webhook(isolated, payload, headers).expect(429);
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
      expect(outbound).toHaveBeenCalledTimes(600);
    } finally {
      await isolated.close();
    }
  }, 15000);
});
