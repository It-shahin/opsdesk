import {
  type ExecutionContext,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
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
import request from 'supertest';

import { AttachmentsController } from '../src/attachments/attachments.controller.js';
import { AttachmentsService } from '../src/attachments/attachments.service.js';
import { InvitationAcceptanceController } from '../src/invitations/invitation-acceptance.controller.js';
import { InvitationsController } from '../src/invitations/invitations.controller.js';
import { InvitationsService } from '../src/invitations/invitations.service.js';
import { PermissionGuard } from '../src/rbac/permission.guard.js';
import { PermissionsService } from '../src/rbac/permissions.service.js';
import { SecurityModule } from '../src/security/security.module.js';
import type {
  TenantAuthenticatedRequest,
  TenantContext,
} from '../src/tenancy/tenant-context.types.js';
import { TenantMembershipGuard } from '../src/tenancy/tenant-membership.guard.js';
import { TicketsController } from '../src/tickets/tickets.controller.js';
import { TicketsService } from '../src/tickets/tickets.service.js';
import { UsersService } from '../src/users/users.service.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const TICKET = '22222222-2222-4222-8222-222222222222';
const ATTACHMENT = '33333333-3333-4333-8333-333333333333';
const tenant: TenantContext = {
  organizationId: ORG,
  userId: 'user',
  membershipId: 'member',
  role: 'OWNER',
};

describe('Sensitive operation HTTP throttling', () => {
  let app: INestApplication;
  const previousRateLimitTests = process.env.RATE_LIMIT_TESTS;
  const accept = jest.fn<(...args: unknown[]) => Promise<{ ok: boolean }>>();
  const create = jest.fn<(...args: unknown[]) => Promise<{ ok: boolean }>>();
  const createMessage =
    jest.fn<(...args: unknown[]) => Promise<{ ok: boolean }>>();
  const initiateUpload =
    jest.fn<(...args: unknown[]) => Promise<{ ok: boolean }>>();
  const completeUpload =
    jest.fn<(...args: unknown[]) => Promise<{ ok: boolean }>>();

  beforeAll(async () => {
    process.env.RATE_LIMIT_TESTS = '1';
    const moduleRef = await Test.createTestingModule({
      imports: [SecurityModule],
      controllers: [
        InvitationAcceptanceController,
        InvitationsController,
        TicketsController,
        AttachmentsController,
      ],
      providers: [
        PermissionsService,
        PermissionGuard,
        { provide: InvitationsService, useValue: { accept, create } },
        { provide: TicketsService, useValue: { createMessage } },
        {
          provide: AttachmentsService,
          useValue: { initiateUpload, completeUpload },
        },
        {
          provide: UsersService,
          useValue: {
            syncAuthenticatedUser: async () => ({
              id: tenant.userId,
              email: 'owner@example.com',
            }),
          },
        },
      ],
    })
      .overrideGuard(TenantMembershipGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context
            .switchToHttp()
            .getRequest<TenantAuthenticatedRequest>().tenant = tenant;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    for (const mock of [
      accept,
      create,
      createMessage,
      initiateUpload,
      completeUpload,
    ])
      mock.mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    jest.restoreAllMocks();
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

  it.each([
    {
      label: 'invitation acceptance',
      path: '/v1/invitations/accept',
      limit: 20,
      ttlSeconds: 60,
      status: 200,
      body: { token: 'a'.repeat(43) },
      service: accept,
    },
    {
      label: 'invitation creation',
      path: `/v1/organizations/${ORG}/invitations`,
      limit: 30,
      ttlSeconds: 600,
      status: 201,
      body: { email: 'invitee@example.com', role: 'AGENT' },
      service: create,
    },
    {
      label: 'ticket replies and notes',
      path: `/v1/organizations/${ORG}/tickets/${TICKET}/messages`,
      limit: 30,
      ttlSeconds: 60,
      status: 201,
      body: { kind: 'PUBLIC_REPLY', body: 'Reply' },
      service: createMessage,
    },
    {
      label: 'attachment initialization',
      path: `/v1/organizations/${ORG}/tickets/${TICKET}/attachments/init`,
      limit: 30,
      ttlSeconds: 60,
      status: 200,
      body: {
        originalName: 'hello.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      },
      service: initiateUpload,
    },
    {
      label: 'attachment completion',
      path: `/v1/organizations/${ORG}/tickets/${TICKET}/attachments/${ATTACHMENT}/complete`,
      limit: 60,
      ttlSeconds: 60,
      status: 200,
      body: {},
      service: completeUpload,
    },
  ])(
    'limits $label to $limit requests in $ttlSeconds seconds before blocking service calls',
    async ({ label, path, limit, ttlSeconds, status, body, service }) => {
      const startedAt = Date.now();
      const now = jest.spyOn(Date, 'now').mockReturnValue(startedAt);
      const send = (index = 0) =>
        request(app.getHttpServer())
          .post(path)
          .set('Authorization', `Bearer ${label}`)
          .send(
            label === 'ticket replies and notes'
              ? {
                  ...body,
                  kind: index % 2 === 0 ? 'PUBLIC_REPLY' : 'INTERNAL_NOTE',
                }
              : body,
          );

      for (let index = 0; index < limit; index++) {
        const response = await send(index).expect(status);
        expect(response.headers['x-ratelimit-limit']).toBe(String(limit));
        expect(response.headers['x-ratelimit-reset']).toBe(String(ttlSeconds));
      }
      const blocked = await send().expect(429);
      expect(blocked.headers['retry-after']).toBe(String(ttlSeconds));
      expect(service).toHaveBeenCalledTimes(limit);

      if (ttlSeconds === 600) {
        now.mockReturnValue(startedAt + 61_000);
        await send().expect(429);
        expect(service).toHaveBeenCalledTimes(limit);
      }

      now.mockReturnValue(startedAt + ttlSeconds * 1000 + 1000);
      await send().expect(status);
      expect(service).toHaveBeenCalledTimes(limit + 1);
    },
  );
});
