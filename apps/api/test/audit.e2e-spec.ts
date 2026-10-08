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

import { AuditController } from '../src/audit/audit.controller.js';
import { AuditService } from '../src/audit/audit.service.js';
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
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
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

describe('Audit history HTTP access', () => {
  let app: INestApplication;
  const findMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
  const count = jest.fn<(...args: unknown[]) => Promise<number>>();
  const transaction = jest.fn(async (operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );
  const logs = [
    { id: 'audit-a', organizationId: ORG_A, action: 'CUSTOMER_CREATED' },
    { id: 'audit-b', organizationId: ORG_B, action: 'CUSTOMER_CREATED' },
  ];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        Reflector,
        AuditService,
        PermissionsService,
        PermissionGuard,
        TenantMembershipGuard,
        {
          provide: PrismaService,
          useValue: {
            auditLog: { findMany, count },
            $transaction: transaction,
          },
        },
        {
          provide: UsersService,
          useValue: {
            syncAuthenticatedUser: async (req: TenantAuthenticatedRequest) => ({
              id: req.auth.sub,
              email: 'test@example.com',
            }),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            resolve: async (role: Role, organizationId: string) =>
              organizationId === ORG_A
                ? {
                    userId: USER_ID,
                    organizationId: ORG_A,
                    membershipId: 'membership-a',
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
    findMany.mockReset();
    count.mockReset();
    transaction.mockClear();
    findMany.mockImplementation(async (args) => {
      const query = args as {
        where: { organizationId?: string; entityId?: string };
      };
      return logs.filter(
        (log) =>
          (!query.where.organizationId ||
            log.organizationId === query.where.organizationId) &&
          !query.where.entityId,
      );
    });
    count.mockResolvedValue(1);
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    { role: 'OWNER', status: 200 },
    { role: 'ADMIN', status: 200 },
    { role: 'AGENT', status: 403 },
    { role: 'VIEWER', status: 403 },
  ])(
    'returns $status when $role requests audit history',
    async ({ role, status }) => {
      await request(app.getHttpServer())
        .get(`/v1/organizations/${ORG_A}/audit-logs`)
        .set('Authorization', `Bearer ${role}`)
        .expect(status);
      expect(findMany).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
      expect(count).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
    },
  );

  it('never returns Org B records to an Org A request', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_A}/audit-logs`)
      .set('Authorization', 'Bearer OWNER')
      .expect(200);
    expect(response.body.data).toEqual([logs[0]]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_A },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 25,
      }),
    );
    expect(count).toHaveBeenCalledWith({ where: { organizationId: ORG_A } });
  });

  it('returns 404 when the caller is not a member of the requested organization', async () => {
    await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_B}/audit-logs`)
      .set('Authorization', 'Bearer OWNER')
      .expect(404);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects requests without authentication', async () => {
    await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_A}/audit-logs`)
      .expect(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('passes validated filters and pagination without removing tenant scope', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_A}/audit-logs`)
      .set('Authorization', 'Bearer ADMIN')
      .query({
        page: 2,
        limit: 10,
        action: 'TICKET_STATUS_CHANGED',
        entityType: 'TICKET',
        entityId: ORG_B,
        actorUserId: USER_ID,
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-08T00:00:00Z',
      })
      .expect(200);
    const where = {
      organizationId: ORG_A,
      action: 'TICKET_STATUS_CHANGED',
      entityType: 'TICKET',
      entityId: ORG_B,
      actorUserId: USER_ID,
      createdAt: {
        gte: new Date('2026-10-01T00:00:00Z'),
        lte: new Date('2026-10-08T00:00:00Z'),
      },
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 10, take: 10 }),
    );
    expect(count).toHaveBeenCalledWith({ where });
    expect(response.body.data).toEqual([]);
  });

  it.each([
    { page: 0 },
    { page: 'abc' },
    { limit: 101 },
    { limit: 0 },
    { action: 'UNKNOWN' },
    { entityType: 'UNKNOWN' },
    { entityId: 'invalid' },
    { actorUserId: 'invalid' },
    { from: 'yesterday' },
    { to: 'tomorrow' },
    { from: '2026-10-08T00:00:00Z', to: '2026-10-01T00:00:00Z' },
    { organizationId: ORG_B },
  ])('rejects invalid or extra query fields: %j', async (query) => {
    await request(app.getHttpServer())
      .get(`/v1/organizations/${ORG_A}/audit-logs`)
      .set('Authorization', 'Bearer OWNER')
      .query(query)
      .expect(400);
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });
});
