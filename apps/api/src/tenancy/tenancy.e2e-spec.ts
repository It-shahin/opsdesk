import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import request from 'supertest';

import type { TenantAuthenticatedRequest } from '../src/tenancy/tenant-context.types.js';
import { TenantContextService } from '../src/tenancy/tenant-context.service.js';
import { TenantMembershipGuard } from '../src/tenancy/tenant-membership.guard.js';
import { MembershipsService } from '../src/memberships/memberships.service.js';
import { OrganizationsController } from '../src/organizations/organizations.controller.js';
import { OrganizationsService } from '../src/organizations/organizations.service.js';
import { UsersService } from '../src/users/users.service.js';

const USER_A_ID =
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const USER_B_ID =
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const ORG_A_ID =
  '11111111-1111-4111-8111-111111111111';

const ORG_B_ID =
  '22222222-2222-4222-8222-222222222222';

@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean {
    const request =
      context
        .switchToHttp()
        .getRequest<TenantAuthenticatedRequest>();

    const authorization =
      request.headers.authorization;

    if (
      authorization ===
      'Bearer token-user-a'
    ) {
      request.auth = {
        sub: 'auth0|user-a',
      };

      request.accessToken =
        'token-user-a';

      return true;
    }

    if (
      authorization ===
      'Bearer token-user-b'
    ) {
      request.auth = {
        sub: 'auth0|user-b',
      };

      request.accessToken =
        'token-user-b';

      return true;
    }

    throw new UnauthorizedException(
      'Missing access token',
    );
  }
}

describe('Tenant isolation', () => {
  let app: INestApplication;

  const syncAuthenticatedUserMock =
    jest.fn();

  const findMembershipMock =
    jest.fn();

  const findOrganizationMock =
    jest.fn();

  beforeAll(async () => {
    syncAuthenticatedUserMock.mockImplementation(
      async (
        request: TenantAuthenticatedRequest,
      ) => {
        if (
          request.auth.sub ===
          'auth0|user-a'
        ) {
          return {
            id: USER_A_ID,
          };
        }

        if (
          request.auth.sub ===
          'auth0|user-b'
        ) {
          return {
            id: USER_B_ID,
          };
        }

        throw new Error(
          'Unknown test user',
        );
      },
    );

    findMembershipMock.mockImplementation(
      async (
        userId: string,
        organizationId: string,
      ) => {
        if (
          userId === USER_A_ID &&
          organizationId === ORG_A_ID
        ) {
          return {
            id: 'membership-a',
            userId: USER_A_ID,
            organizationId: ORG_A_ID,
            role: 'OWNER',
            organization: {
              id: ORG_A_ID,
              name: 'Organization A',
              slug: 'organization-a',
            },
          };
        }

        if (
          userId === USER_B_ID &&
          organizationId === ORG_B_ID
        ) {
          return {
            id: 'membership-b',
            userId: USER_B_ID,
            organizationId: ORG_B_ID,
            role: 'OWNER',
            organization: {
              id: ORG_B_ID,
              name: 'Organization B',
              slug: 'organization-b',
            },
          };
        }

        return null;
      },
    );

    findOrganizationMock.mockImplementation(
      async (
        organizationId: string,
      ) => {
        if (
          organizationId === ORG_A_ID
        ) {
          return {
            id: ORG_A_ID,
            name: 'Organization A',
            slug: 'organization-a',
            createdAt: new Date(
              '2026-01-01T00:00:00.000Z',
            ),
            updatedAt: new Date(
              '2026-01-01T00:00:00.000Z',
            ),
          };
        }

        if (
          organizationId === ORG_B_ID
        ) {
          return {
            id: ORG_B_ID,
            name: 'Organization B',
            slug: 'organization-b',
            createdAt: new Date(
              '2026-01-02T00:00:00.000Z',
            ),
            updatedAt: new Date(
              '2026-01-02T00:00:00.000Z',
            ),
          };
        }

        return null;
      },
    );

    const moduleRef =
      await Test.createTestingModule({
        controllers: [
          OrganizationsController,
        ],

        providers: [
          TenantContextService,
          TenantMembershipGuard,

          {
            provide: UsersService,
            useValue: {
              syncAuthenticatedUser:
                syncAuthenticatedUserMock,
            },
          },

          {
            provide: MembershipsService,
            useValue: {
              findForUserAndOrganization:
                findMembershipMock,
            },
          },

          {
            provide: OrganizationsService,
            useValue: {
              findById:
                findOrganizationMock,
            },
          },
        ],
      }).compile();

    app =
      moduleRef.createNestApplication();

    app.useGlobalGuards(
      new TestAuthGuard(),
    );

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows user A to access organization A', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          `/v1/organizations/${ORG_A_ID}`,
        )
        .set(
          'Authorization',
          'Bearer token-user-a',
        )
        .expect(200);

    expect(response.body).toMatchObject({
      id: ORG_A_ID,
      name: 'Organization A',
      role: 'OWNER',
    });

    expect(
      findOrganizationMock,
    ).toHaveBeenCalledWith(
      ORG_A_ID,
    );
  });

  it('prevents user A from accessing organization B', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        `/v1/organizations/${ORG_B_ID}`,
      )
      .set(
        'Authorization',
        'Bearer token-user-a',
      )
      .expect(404);

    expect(
      findMembershipMock,
    ).toHaveBeenCalledWith(
      USER_A_ID,
      ORG_B_ID,
    );

    expect(
      findOrganizationMock,
    ).not.toHaveBeenCalled();
  });

  it('allows user B to access organization B', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          `/v1/organizations/${ORG_B_ID}`,
        )
        .set(
          'Authorization',
          'Bearer token-user-b',
        )
        .expect(200);

    expect(response.body).toMatchObject({
      id: ORG_B_ID,
      name: 'Organization B',
      role: 'OWNER',
    });

    expect(
      findOrganizationMock,
    ).toHaveBeenCalledWith(
      ORG_B_ID,
    );
  });

  it('prevents user B from accessing organization A', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        `/v1/organizations/${ORG_A_ID}`,
      )
      .set(
        'Authorization',
        'Bearer token-user-b',
      )
      .expect(404);

    expect(
      findMembershipMock,
    ).toHaveBeenCalledWith(
      USER_B_ID,
      ORG_A_ID,
    );

    expect(
      findOrganizationMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects malformed organization IDs before tenant lookup', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        '/v1/organizations/not-a-uuid',
      )
      .set(
        'Authorization',
        'Bearer token-user-a',
      )
      .expect(400);

    expect(
      findMembershipMock,
    ).not.toHaveBeenCalled();

    expect(
      findOrganizationMock,
    ).not.toHaveBeenCalled();
  });
});