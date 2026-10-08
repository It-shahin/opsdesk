import { type INestApplication, ValidationPipe } from '@nestjs/common';
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

import { OrganizationsService } from '../src/organizations/organizations.service.js';
import { TenantMembershipGuard } from '../src/tenancy/tenant-membership.guard.js';
import { UsersService } from '../src/users/users.service.js';

describe('Organization creation throttling', () => {
  let app: INestApplication;
  const previousRateLimitTests = process.env.RATE_LIMIT_TESTS;
  const createForUser = jest.fn<OrganizationsService['createForUser']>();
  const listForUser = jest.fn<OrganizationsService['listForUser']>();
  const syncAuthenticatedUser =
    jest.fn<UsersService['syncAuthenticatedUser']>();

  beforeAll(async () => {
    process.env.RATE_LIMIT_TESTS = '1';
    // Load the CommonJS throttler after Nest's ESM packages have initialized.
    const { OrganizationsController } =
      await import('../src/organizations/organizations.controller.js');
    const { SecurityModule } =
      await import('../src/security/security.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [SecurityModule],
      controllers: [OrganizationsController],
      providers: [
        {
          provide: OrganizationsService,
          useValue: { createForUser, listForUser },
        },
        { provide: UsersService, useValue: { syncAuthenticatedUser } },
      ],
    })
      .overrideGuard(TenantMembershipGuard)
      .useValue({ canActivate: () => true })
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
    const now = new Date();
    createForUser.mockResolvedValue({
      id: 'organization',
      name: 'Workspace',
      slug: 'workspace',
      role: 'OWNER',
      createdAt: now,
      updatedAt: now,
    });
    listForUser.mockResolvedValue([]);
    syncAuthenticatedUser.mockResolvedValue({
      id: 'user',
      authProviderId: 'subject',
      email: 'user@example.com',
      name: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    });
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

  it('allows five creations, rejects the sixth and stays blocked beyond the global one-minute duration', async () => {
    const startedAt = Date.now();
    const now = jest.spyOn(Date, 'now').mockReturnValue(startedAt);
    const create = () =>
      request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Authorization', 'Bearer organization-creation-limit')
        .send({ name: 'Workspace' });
    for (let index = 0; index < 5; index++) {
      const response = await create().expect(201);
      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-reset']).toBe('600');
    }
    const blocked = await create().expect(429);
    expect(blocked.headers['retry-after']).toBe('600');
    expect(createForUser).toHaveBeenCalledTimes(5);
    expect(syncAuthenticatedUser).toHaveBeenCalledTimes(5);

    now.mockReturnValue(startedAt + 61_000);
    await create().expect(429);
    expect(createForUser).toHaveBeenCalledTimes(5);

    now.mockReturnValue(startedAt + 601_000);
    await create().expect(201);
    expect(createForUser).toHaveBeenCalledTimes(6);
  });

  it('keeps the broader global quota on organization listing', async () => {
    for (let index = 0; index < 6; index++) {
      const response = await request(app.getHttpServer())
        .get('/v1/organizations')
        .set('Authorization', 'Bearer organization-list-limit')
        .expect(200);
      expect(response.headers['x-ratelimit-limit']).toBe('240');
    }
    expect(listForUser).toHaveBeenCalledTimes(6);
    expect(createForUser).not.toHaveBeenCalled();
  });
});
