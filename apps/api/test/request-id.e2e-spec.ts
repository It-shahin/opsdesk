import {
  Controller,
  ForbiddenException,
  Get,
  type INestApplication,
  Logger,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle } from '@nestjs/throttler';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { AccessTokenVerifierService } from '../src/auth/access-token-verifier.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { ObservabilityModule } from '../src/observability/observability.module.js';
import { SecurityModule } from '../src/security/security.module.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providedId = '26ce1b19-42a1-4f6a-8ec8-44669091138c';

@Controller('request-id')
class RequestIdController {
  @Get('customers/:customerId') customer() {
    return { ok: true };
  }
  @Get() get() {
    return { ok: true };
  }
  @Get('forbidden') forbidden() {
    throw new ForbiddenException();
  }
  @Get('error') error() {
    throw new Error('private application failure');
  }
  @Get('limited')
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  limited() {
    return { ok: true };
  }
}

describe('Request IDs across the HTTP pipeline', () => {
  let app: INestApplication;
  const previousRateLimitTests = process.env.RATE_LIMIT_TESTS;
  beforeAll(async () => {
    process.env.RATE_LIMIT_TESTS = '1';
    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule, SecurityModule],
      controllers: [RequestIdController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        {
          provide: AccessTokenVerifierService,
          useValue: { verify: async () => ({ sub: 'test-user' }) },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
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

  it('generates a UUID v4 without an incoming ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/request-id')
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(response.headers['x-request-id']).toMatch(UUID_V4);
  });
  it('returns the incoming valid UUID v4 unchanged', async () => {
    const response = await request(app.getHttpServer())
      .get('/request-id')
      .set('Authorization', 'Bearer test-token')
      .set('X-Request-Id', providedId)
      .expect(200);
    expect(response.headers['x-request-id']).toBe(providedId);
  });
  it.each(['hello', '26ce1b19-42a1-1f6a-8ec8-44669091138c'])(
    'replaces invalid or non-v4 ID %s',
    async (id) => {
      const response = await request(app.getHttpServer())
        .get('/request-id')
        .set('Authorization', 'Bearer test-token')
        .set('X-Request-Id', id)
        .expect(200);
      expect(response.headers['x-request-id']).toMatch(UUID_V4);
      expect(response.headers['x-request-id']).not.toBe(id);
    },
  );
  it('generates distinct IDs for two requests', async () => {
    const first = await request(app.getHttpServer())
      .get('/request-id')
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/request-id')
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(first.headers['x-request-id']).not.toBe(
      second.headers['x-request-id'],
    );
  });
  it.each([
    [401, '/request-id', false],
    [403, '/request-id/forbidden', true],
    [404, '/does-not-exist', true],
    [500, '/request-id/error', true],
  ] as const)(
    'returns an ID on %i responses',
    async (status, path, authenticated) => {
      const req = request(app.getHttpServer())
        .get(path)
        .set('X-Request-Id', providedId);
      if (authenticated) req.set('Authorization', 'Bearer test-token');
      const response = await req.expect(status);
      expect(response.headers['x-request-id']).toBe(providedId);
    },
  );
  it('returns an ID when throttling rejects the request before controller execution', async () => {
    await request(app.getHttpServer())
      .get('/request-id/limited')
      .set('Authorization', 'Bearer rate-test-token')
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/request-id/limited')
      .set('Authorization', 'Bearer rate-test-token')
      .set('X-Request-Id', providedId)
      .expect(429);
    expect(response.headers['x-request-id']).toBe(providedId);
  });

  it.each([
    [
      '/request-id/customers/private%40example.test?token=SECRET',
      200,
      '/request-id/customers/:customerId',
    ],
    ['/unmatched/SECRET/private%40example.test', 404, '/[unmatched]'],
  ])(
    'logs a route template or redacted fallback for %s',
    async (path, status, expectedPath) => {
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});
      try {
        await request(app.getHttpServer())
          .get(path)
          .set('Authorization', 'Bearer test-token')
          .expect(status);
        const events = [...log.mock.calls, ...warn.mock.calls]
          .map(([message]) => String(message))
          .filter((message) => message.includes('http.request'));
        expect(events).toHaveLength(1);
        expect(JSON.parse(events[0]!).path).toBe(expectedPath);
        expect(events[0]).not.toMatch(
          /SECRET|private%40example.test|private@example.test/,
        );
      } finally {
        log.mockRestore();
        warn.mockRestore();
      }
    },
  );
});
