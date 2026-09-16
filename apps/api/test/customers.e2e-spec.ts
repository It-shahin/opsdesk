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

import { CustomersController } from '../src/customers/customers.controller.js';
import { CustomersService } from '../src/customers/customers.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { PermissionGuard } from '../src/rbac/permission.guard.js';
import { PermissionsService } from '../src/rbac/permissions.service.js';
import { TenantContextService } from '../src/tenancy/tenant-context.service.js';
import type { TenantAuthenticatedRequest } from '../src/tenancy/tenant-context.types.js';
import { TenantMembershipGuard } from '../src/tenancy/tenant-membership.guard.js';
import { UsersService } from '../src/users/users.service.js';

const ORG_A =
  '11111111-1111-4111-8111-111111111111';
const ORG_B =
  '22222222-2222-4222-8222-222222222222';
const CUSTOMER_A =
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CUSTOMER_B =
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const USERS = {
  owner: {
    id:
      '10000000-0000-4000-8000-000000000001',
    sub: 'auth0|owner',
    email: 'owner@example.com',
    role: 'OWNER',
  },
  agent: {
    id:
      '10000000-0000-4000-8000-000000000002',
    sub: 'auth0|agent',
    email: 'agent@example.com',
    role: 'AGENT',
  },
  viewer: {
    id:
      '10000000-0000-4000-8000-000000000003',
    sub: 'auth0|viewer',
    email: 'viewer@example.com',
    role: 'VIEWER',
  },
} as const;

@Injectable()
class TestAuthGuard
  implements CanActivate
{
  canActivate(
    context: ExecutionContext,
  ): boolean {
    const request =
      context
        .switchToHttp()
        .getRequest<TenantAuthenticatedRequest>();

    const authorization =
      request.headers.authorization;

    const identities: Record<
      string,
      string
    > = {
      'Bearer owner-token':
        USERS.owner.sub,
      'Bearer agent-token':
        USERS.agent.sub,
      'Bearer viewer-token':
        USERS.viewer.sub,
    };

    const sub = authorization
      ? identities[authorization]
      : undefined;

    if (!sub) {
      throw new UnauthorizedException();
    }

    request.auth = { sub };
    request.accessToken =
      authorization.replace(
        'Bearer ',
        '',
      );

    return true;
  }
}

describe('Customers HTTP security', () => {
  let app: INestApplication;

  const syncUserMock = jest.fn();
  const resolveTenantMock = jest.fn();
  const customerCreateMock = jest.fn();
  const customerFindManyMock = jest.fn();
  const customerFindFirstMock = jest.fn();
  const customerCountMock = jest.fn();
  const customerUpdateMock = jest.fn();
  const transactionMock = jest.fn();

  const customerA = {
    id: CUSTOMER_A,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: null,
    company: 'Acme',
    notes: null,
    archivedAt: null,
    createdAt:
      new Date(
        '2026-09-01T10:00:00.000Z',
      ),
    updatedAt:
      new Date(
        '2026-09-01T10:00:00.000Z',
      ),
  };

  beforeAll(async () => {
    const prisma = {
      customer: {
        create:
          customerCreateMock,
        findMany:
          customerFindManyMock,
        findFirst:
          customerFindFirstMock,
        count:
          customerCountMock,
        update:
          customerUpdateMock,
      },
      $transaction:
        transactionMock,
    };

    const moduleRef =
      await Test.createTestingModule({
        controllers: [
          CustomersController,
        ],
        providers: [
          Reflector,
          PermissionsService,
          PermissionGuard,
          TenantMembershipGuard,
          CustomersService,
          {
            provide: PrismaService,
            useValue: prisma,
          },
          {
            provide:
              TenantContextService,
            useValue: {
              resolve:
                resolveTenantMock,
            },
          },
          {
            provide: UsersService,
            useValue: {
              syncAuthenticatedUser:
                syncUserMock,
            },
          },
        ],
      }).compile();

    app =
      moduleRef.createNestApplication();

    app.useGlobalGuards(
      new TestAuthGuard(),
    );
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

    syncUserMock.mockImplementation(
      async (
        request:
          TenantAuthenticatedRequest,
      ) => {
        const user =
          Object.values(USERS).find(
            (candidate) =>
              candidate.sub ===
              request.auth.sub,
          );

        if (!user) {
          throw new Error(
            'Unknown test user',
          );
        }

        return {
          id: user.id,
          email: user.email,
        };
      },
    );

    resolveTenantMock.mockImplementation(
      async (
        userId: string,
        organizationId: string,
      ) => {
        if (organizationId !== ORG_A) {
          return null;
        }

        const user =
          Object.values(USERS).find(
            (candidate) =>
              candidate.id === userId,
          );

        if (!user) {
          return null;
        }

        return {
          userId: user.id,
          organizationId: ORG_A,
          membershipId:
            `membership-${user.role.toLowerCase()}`,
          role: user.role,
        };
      },
    );

    customerFindManyMock.mockResolvedValue(
      [],
    );
    customerCountMock.mockResolvedValue(0);
    transactionMock.mockImplementation(
      async (
        operations:
          Promise<unknown>[],
      ) => Promise.all(operations),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows a viewer to read customers', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        `/v1/organizations/${ORG_A}/customers`,
      )
      .set(
        'Authorization',
        'Bearer viewer-token',
      )
      .expect(200);
  });

  it('prevents a viewer from creating customers', async () => {
    await request(
      app.getHttpServer(),
    )
      .post(
        `/v1/organizations/${ORG_A}/customers`,
      )
      .set(
        'Authorization',
        'Bearer viewer-token',
      )
      .send({
        name: 'Blocked Customer',
      })
      .expect(403);

    expect(
      customerCreateMock,
    ).not.toHaveBeenCalled();
  });

  it('allows an agent to create customers', async () => {
    customerFindFirstMock.mockResolvedValue(
      null,
    );
    customerCreateMock.mockResolvedValue({
      ...customerA,
    });

    await request(
      app.getHttpServer(),
    )
      .post(
        `/v1/organizations/${ORG_A}/customers`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        name: 'Jane Doe',
        email: 'JANE@EXAMPLE.COM',
        company: 'Acme',
      })
      .expect(201);

    expect(
      customerCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data:
          expect.objectContaining({
            organizationId: ORG_A,
            email:
              'jane@example.com',
          }),
      }),
    );
  });

  it('blocks access to customers through another tenant', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        `/v1/organizations/${ORG_B}/customers`,
      )
      .set(
        'Authorization',
        'Bearer owner-token',
      )
      .expect(404);

    expect(
      customerFindManyMock,
    ).not.toHaveBeenCalled();
  });

  it('returns 404 when a customer is outside the active tenant', async () => {
    customerFindFirstMock.mockImplementation(
      async ({
        where,
      }: {
        where: {
          id?: string;
          organizationId?: string;
        };
      }) => {
        if (
          where.id === CUSTOMER_B &&
          where.organizationId === ORG_A
        ) {
          return null;
        }

        return customerA;
      },
    );

    await request(
      app.getHttpServer(),
    )
      .get(
        `/v1/organizations/${ORG_A}/customers/${CUSTOMER_B}`,
      )
      .set(
        'Authorization',
        'Bearer owner-token',
      )
      .expect(404);

    expect(
      customerFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CUSTOMER_B,
          organizationId: ORG_A,
        },
      }),
    );
  });

  it('returns paginated customer results', async () => {
    customerFindManyMock.mockResolvedValue([
      customerA,
    ]);
    customerCountMock.mockResolvedValue(25);

    const response = await request(
      app.getHttpServer(),
    )
      .get(
        `/v1/organizations/${ORG_A}/customers?page=2&limit=10`,
      )
      .set(
        'Authorization',
        'Bearer owner-token',
      )
      .expect(200);

    expect(
      response.body.pagination,
    ).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });

    expect(
      customerFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where:
          expect.objectContaining({
            organizationId: ORG_A,
            archivedAt: null,
          }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('keeps search queries scoped to the tenant', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        `/v1/organizations/${ORG_A}/customers?search=jane`,
      )
      .set(
        'Authorization',
        'Bearer owner-token',
      )
      .expect(200);

    expect(
      customerFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where:
          expect.objectContaining({
            organizationId: ORG_A,
            archivedAt: null,
            OR:
              expect.any(Array),
          }),
      }),
    );
  });

  it.each([
    ['page zero', 'page=0'],
    ['an excessive page size', 'limit=5000'],
    ['a nonnumeric page', 'page=abc'],
  ])(
    'rejects %s',
    async (_description, query) => {
      await request(
        app.getHttpServer(),
      )
        .get(
          `/v1/organizations/${ORG_A}/customers?${query}`,
        )
        .set(
          'Authorization',
          'Bearer owner-token',
        )
        .expect(400);

      expect(
        customerFindManyMock,
      ).not.toHaveBeenCalled();
    },
  );

  it('allows an agent to update a customer', async () => {
    customerFindFirstMock.mockResolvedValue({
      id: CUSTOMER_A,
      email: 'jane@example.com',
      archivedAt: null,
    });
    customerUpdateMock.mockResolvedValue({
      ...customerA,
      company: 'Updated Company',
    });

    const response = await request(
      app.getHttpServer(),
    )
      .patch(
        `/v1/organizations/${ORG_A}/customers/${CUSTOMER_A}`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        company: 'Updated Company',
      })
      .expect(200);

    expect(response.body.company).toBe(
      'Updated Company',
    );
  });

  it('prevents a viewer from updating customers', async () => {
    await request(
      app.getHttpServer(),
    )
      .patch(
        `/v1/organizations/${ORG_A}/customers/${CUSTOMER_A}`,
      )
      .set(
        'Authorization',
        'Bearer viewer-token',
      )
      .send({
        company:
          'Unauthorized Change',
      })
      .expect(403);

    expect(
      customerUpdateMock,
    ).not.toHaveBeenCalled();
  });

  it('archives a customer without deleting it', async () => {
    customerFindFirstMock.mockResolvedValue({
      id: CUSTOMER_A,
      archivedAt: null,
    });
    customerUpdateMock.mockResolvedValue({
      ...customerA,
      archivedAt: new Date(),
    });

    const response = await request(
      app.getHttpServer(),
    )
      .post(
        `/v1/organizations/${ORG_A}/customers/${CUSTOMER_A}/archive`,
      )
      .set(
        'Authorization',
        'Bearer owner-token',
      )
      .expect(200);

    expect(
      response.body.archivedAt,
    ).not.toBeNull();
    expect(
      customerUpdateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          archivedAt:
            expect.any(Date),
        },
      }),
    );
  });

  it('restores an archived customer', async () => {
    customerFindFirstMock
      .mockResolvedValueOnce({
        id: CUSTOMER_A,
        email: 'jane@example.com',
        archivedAt: new Date(),
      })
      .mockResolvedValueOnce(null);
    customerUpdateMock.mockResolvedValue({
      ...customerA,
      archivedAt: null,
    });

    const response = await request(
      app.getHttpServer(),
    )
      .post(
        `/v1/organizations/${ORG_A}/customers/${CUSTOMER_A}/restore`,
      )
      .set(
        'Authorization',
        'Bearer owner-token',
      )
      .expect(200);

    expect(
      response.body.archivedAt,
    ).toBeNull();
    expect(
      customerUpdateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          archivedAt: null,
        },
      }),
    );
  });

  it('rejects duplicate active customer emails', async () => {
    customerFindFirstMock.mockResolvedValue({
      id: CUSTOMER_A,
    });

    await request(
      app.getHttpServer(),
    )
      .post(
        `/v1/organizations/${ORG_A}/customers`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        name: 'Duplicate Jane',
        email: 'jane@example.com',
      })
      .expect(409);

    expect(
      customerCreateMock,
    ).not.toHaveBeenCalled();
  });
});
