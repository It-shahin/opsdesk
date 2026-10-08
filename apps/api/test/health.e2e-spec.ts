import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import request from 'supertest';

import { AppController } from '../src/app.controller.js';
import { AccessTokenVerifierService } from '../src/auth/access-token-verifier.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { HealthService } from '../src/health/health.service.js';
import { ObservabilityModule } from '../src/observability/observability.module.js';
import { RedisService } from '../src/redis/redis.service.js';
import { SecurityModule } from '../src/security/security.module.js';

describe('Public liveness and readiness endpoints', () => {
  let app: INestApplication;
  const previousRateLimitTests = process.env.RATE_LIMIT_TESTS;
  const query = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const ping = jest.fn<RedisService['ping']>();
  const verify = jest.fn<AccessTokenVerifierService['verify']>();

  beforeAll(async () => {
    process.env.RATE_LIMIT_TESTS = '1';
    const moduleRef = await Test.createTestingModule({
      imports: [SecurityModule, ObservabilityModule],
      controllers: [AppController],
      providers: [
        HealthService,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: AccessTokenVerifierService, useValue: { verify } },
        { provide: PrismaService, useValue: { $queryRaw: query } },
        { provide: RedisService, useValue: { ping } },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    query.mockResolvedValue([{ result: 1 }]);
    ping.mockResolvedValue('PONG');
    verify.mockRejectedValue(new UnauthorizedException());
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

  it('preserves the public root response without checking dependencies', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200, { name: 'OpsDesk API', status: 'running' });
    expect(query).not.toHaveBeenCalled();
    expect(ping).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it('returns liveness and integer uptime even while both dependencies are unavailable', async () => {
    query.mockRejectedValue(new Error('database unavailable'));
    ping.mockRejectedValue(new Error('cache unavailable'));
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(response.body.status).toBe('ok');
    expect(Number.isInteger(response.body.uptimeSeconds)).toBe(true);
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(query).not.toHaveBeenCalled();
    expect(ping).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it.each(['/health/ready', '/health'])(
    'returns 200 from %s when PG and Redis work',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path).expect(200);
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
      expect(response.body).toMatchObject({
        status: 'ready',
        services: {
          database: { status: 'up', latencyMs: expect.any(Number) },
          redis: { status: 'up', latencyMs: expect.any(Number) },
        },
      });
      expect(query).toHaveBeenCalledTimes(1);
      expect(ping).toHaveBeenCalledTimes(1);
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['/health/ready', 'database'],
    ['/health/ready', 'redis'],
    ['/health', 'database'],
    ['/health', 'redis'],
  ])('returns generic 503 from %s when %s fails', async (path, dependency) => {
    const connectionString =
      dependency === 'database'
        ? 'postgres://user:secret-password@private-host/database'
        : 'redis://user:secret-password@private-host:6379';
    const error = new Error(connectionString);
    error.stack = `PRIVATE_STACK_TRACE\n at connect (${connectionString})`;
    if (dependency === 'database') query.mockRejectedValue(error);
    else ping.mockRejectedValue(error);
    const response = await request(app.getHttpServer()).get(path).expect(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.services[dependency].status).toBe('down');
    expect(
      response.body.services[dependency === 'database' ? 'redis' : 'database']
        .status,
    ).toBe('up');
    expect(JSON.stringify(response.body)).not.toContain('secret-password');
    expect(JSON.stringify(response.body)).not.toContain(connectionString);
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_STACK_TRACE');
    expect(response.body).not.toHaveProperty('stack');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('treats an unexpected Redis ping response as unavailable', async () => {
    ping.mockResolvedValue('unexpected');
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);
    expect(response.body.services.redis.status).toBe('down');
  });

  it('bounds readiness when dependencies stop responding', async () => {
    query.mockImplementation(() => new Promise(() => {}));
    ping.mockImplementation(() => new Promise(() => {}));
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);
    expect(response.body.services.database.status).toBe('down');
    expect(response.body.services.redis.status).toBe('down');
  });

  it('skips rate-limit storage for all probe routes with throttling enabled', async () => {
    const increment = jest.spyOn(
      app.get<ThrottlerStorage>(ThrottlerStorage),
      'increment',
    );
    try {
      for (const path of ['/', '/health/live', '/health/ready', '/health']) {
        const response = await request(app.getHttpServer())
          .get(path)
          .expect(200);
        expect(response.headers['x-ratelimit-limit']).toBeUndefined();
        expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
      }
      expect(increment).not.toHaveBeenCalled();
    } finally {
      increment.mockRestore();
    }
  });
});
