import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { AppController } from '../src/app.controller.js';
import { IS_PUBLIC_KEY } from '../src/auth/public.decorator.js';
import type { AuthenticatedRequest } from '../src/auth/auth.types.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';
import { UsersController } from '../src/users/users.controller.js';
import { UsersService } from '../src/users/users.service.js';

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (authorization !== 'Bearer test-token') {
      throw new UnauthorizedException('Missing access token');
    }

    request.auth = {
      sub: 'google-oauth2|test-user',
    };

    request.accessToken = 'test-token';

    return true;
  }
}

describe('Authentication HTTP flow', () => {
  let app: INestApplication;

  const syncAuthenticatedUser =
    jest.fn<UsersService['syncAuthenticatedUser']>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController, UsersController],

      providers: [
        Reflector,

        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest
              .fn<(...args: unknown[]) => Promise<unknown[]>>()
              .mockResolvedValue([{ '?column?': 1 }]),
          },
        },

        {
          provide: RedisService,
          useValue: {
            ping: jest.fn<() => Promise<string>>().mockResolvedValue('PONG'),
          },
        },

        {
          provide: UsersService,
          useValue: {
            syncAuthenticatedUser,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalGuards(new TestAuthGuard(moduleRef.get(Reflector)));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows unauthenticated access to /health', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        status: 'healthy',
        services: {
          database: 'connected',
          redis: 'connected',
        },
      });
  });

  it('rejects unauthenticated access to /v1/me', async () => {
    await request(app.getHttpServer()).get('/v1/me').expect(401);
  });

  it('returns the current OpsDesk user when authenticated', async () => {
    const user = {
      id: '11111111-1111-1111-1111-111111111111',
      authProviderId: 'google-oauth2|test-user',
      email: 'user@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      createdAt: new Date('2026-09-12T10:00:00.000Z'),
      updatedAt: new Date('2026-09-12T10:00:00.000Z'),
    };

    syncAuthenticatedUser.mockResolvedValue(user);

    const response = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });

    expect(response.body).not.toHaveProperty('authProviderId');
  });
});
