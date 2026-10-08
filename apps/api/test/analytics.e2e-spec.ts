import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
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

import { AnalyticsController } from '../src/analytics/analytics.controller.js';
import { AnalyticsService } from '../src/analytics/analytics.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { Role } from '../src/generated/prisma/enums.js';
import { PermissionGuard } from '../src/rbac/permission.guard.js';
import { PermissionsService } from '../src/rbac/permissions.service.js';
import { TenantContextService } from '../src/tenancy/tenant-context.service.js';
import type { TenantAuthenticatedRequest } from '../src/tenancy/tenant-context.types.js';
import { TenantMembershipGuard } from '../src/tenancy/tenant-membership.guard.js';
import { UsersService } from '../src/users/users.service.js';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const EMPTY_ORG = '33333333-3333-4333-8333-333333333333';
const roles: Role[] = ['OWNER', 'ADMIN', 'AGENT', 'VIEWER'];

@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<TenantAuthenticatedRequest>();
    const role = req.headers.authorization?.replace('Bearer ', '') as Role;
    if (!roles.includes(role)) throw new UnauthorizedException();
    req.auth = { sub: role };
    req.accessToken = role;
    return true;
  }
}

describe('Analytics overview HTTP access', () => {
  let app: INestApplication;
  const ticketGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const ticketCount = jest.fn<(args: unknown) => Promise<number>>();
  const customerCount = jest.fn<(args: unknown) => Promise<number>>();
  const emailGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const members = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const queryRaw =
    jest.fn<
      (sql: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>
    >();
  const databaseMocks = [
    ticketGroupBy,
    ticketCount,
    customerCount,
    emailGroupBy,
    members,
    queryRaw,
  ];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        Reflector,
        PermissionsService,
        PermissionGuard,
        TenantMembershipGuard,
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            ticket: { groupBy: ticketGroupBy, count: ticketCount },
            customer: { count: customerCount },
            emailDelivery: { groupBy: emailGroupBy },
            membership: { findMany: members },
            $queryRaw: queryRaw,
          },
        },
        {
          provide: UsersService,
          useValue: {
            syncAuthenticatedUser: async (req: TenantAuthenticatedRequest) => ({
              id: req.auth.sub,
            }),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            resolve: async (role: Role, organizationId: string) =>
              organizationId === ORG_A || organizationId === EMPTY_ORG
                ? {
                    organizationId,
                    userId: 'user-a',
                    membershipId: 'member-a',
                    role,
                  }
                : null,
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new TestAuthGuard());
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
    jest.resetAllMocks();
    ticketGroupBy.mockImplementation(async (args) => {
      const query = args as { by: string[]; where: { organizationId: string } };
      if (query.where.organizationId === EMPTY_ORG) return [];
      const total = query.where.organizationId === ORG_A ? 15 : 99;
      if (query.by[0] === 'status')
        return [
          { status: 'OPEN', _count: { _all: total - 10 } },
          { status: 'RESOLVED', _count: { _all: 10 } },
        ];
      if (query.by[0] === 'priority')
        return [{ priority: 'NORMAL', _count: { _all: total } }];
      if (query.by[0] === 'source')
        return [{ source: 'MANUAL', _count: { _all: total } }];
      return [];
    });
    ticketCount.mockResolvedValue(0);
    customerCount.mockResolvedValue(0);
    emailGroupBy.mockResolvedValue([]);
    members.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]);
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each(roles)(
    'allows %s to read the overview with the default 30-day range',
    async (role) => {
      const response = await request(app.getHttpServer())
        .get(`/v1/organizations/${ORG_A}/analytics/overview`)
        .set('Authorization', `Bearer ${role}`)
        .expect(200);
      expect(response.body.range.preset).toBe('30d');
      expect(response.body.tickets.total).toBe(15);
      expect(response.body.tickets.open).toBe(5);
    },
  );

  it.each(['7d', '30d', '90d'] as const)(
    'returns the selected %s number of daily entries',
    async (range) => {
      const response = await request(app.getHttpServer())
        .get(`/v1/organizations/${ORG_A}/analytics/overview`)
        .set('Authorization', 'Bearer OWNER')
        .query({ range })
        .expect(200);
      expect(response.body.range.preset).toBe(range);
      expect(response.body.ticketVolume).toHaveLength(
        Number.parseInt(range, 10),
      );
    },
  );

  it.each([
    { range: '1d' },
    { range: '365d' },
    { range: '' },
    { range: ['7d', '90d'] },
    { organizationId: ORG_B },
  ])('rejects invalid or extra query parameters: %j', async (query) => {
    await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_A}/analytics/overview`)
      .set('Authorization', 'Bearer OWNER')
      .query(query)
      .expect(400);
    for (const mock of databaseMocks) expect(mock).not.toHaveBeenCalled();
  });

  it('returns Org A metrics and rejects the same user requesting Org B metrics', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_A}/analytics/overview`)
      .set('Authorization', 'Bearer OWNER')
      .expect(200);
    expect(response.body.tickets.total).toBe(15);
    for (const mock of [
      ticketGroupBy,
      ticketCount,
      customerCount,
      emailGroupBy,
      members,
    ]) {
      for (const [args] of mock.mock.calls)
        expect(args).toEqual(
          expect.objectContaining({
            where: expect.objectContaining({ organizationId: ORG_A }),
          }),
        );
    }
    for (const [, organizationId] of queryRaw.mock.calls)
      expect(organizationId).toBe(ORG_A);
    for (const mock of databaseMocks) mock.mockClear();
    await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_B}/analytics/overview`)
      .set('Authorization', 'Bearer OWNER')
      .expect(404);
    for (const mock of databaseMocks) expect(mock).not.toHaveBeenCalled();
  });

  it.each(['7d', '30d', '90d'])(
    'returns zero-filled %s metrics for an empty organization',
    async (range) => {
      const response = await request(app.getHttpServer())
        .get(`/v1/organizations/${EMPTY_ORG}/analytics/overview`)
        .set('Authorization', 'Bearer OWNER')
        .query({ range })
        .expect(200);
      expect(response.body.tickets).toMatchObject({
        total: 0,
        averageResolutionMinutes: null,
      });
      expect(response.body.customers.total).toBe(0);
      expect(response.body.email).toMatchObject({
        deliveryRatePercent: null,
        failureRatePercent: null,
      });
      expect(response.body.ticketVolume).toHaveLength(
        Number.parseInt(range, 10),
      );
      for (const day of response.body.ticketVolume)
        expect(day).toMatchObject({ created: 0, resolved: 0 });
    },
  );

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_A}/analytics/overview`)
      .expect(401);
    for (const mock of databaseMocks) expect(mock).not.toHaveBeenCalled();
  });
});
