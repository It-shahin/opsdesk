import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  Injectable,
  UnauthorizedException,
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

import { InvitationAcceptanceController } from '../src/invitations/invitation-acceptance.controller.js';
import { InvitationsController } from '../src/invitations/invitations.controller.js';
import { InvitationsService } from '../src/invitations/invitations.service.js';
import { MembersController } from '../src/members/members.controller.js';
import { MembersService } from '../src/members/members.service.js';
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
const MEMBERSHIP_ID =
  '33333333-3333-4333-8333-333333333333';

const USER_IDS = {
  owner:
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  admin:
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  agent:
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  viewer:
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  invited:
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
} as const;

const USER_ROLES = {
  [USER_IDS.owner]: 'OWNER',
  [USER_IDS.admin]: 'ADMIN',
  [USER_IDS.agent]: 'AGENT',
  [USER_IDS.viewer]: 'VIEWER',
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
        'auth0|owner',
      'Bearer admin-token':
        'auth0|admin',
      'Bearer agent-token':
        'auth0|agent',
      'Bearer viewer-token':
        'auth0|viewer',
      'Bearer invited-token':
        'auth0|invited',
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

describe('Phase 3 RBAC', () => {
  let app: INestApplication;

  const syncUserMock = jest.fn();
  const resolveTenantMock = jest.fn();
  const listMembersMock = jest.fn();
  const updateMemberRoleMock = jest.fn();
  const createInvitationMock = jest.fn();
  const listInvitationsMock = jest.fn();
  const cancelInvitationMock = jest.fn();
  const acceptInvitationMock = jest.fn();

  beforeAll(async () => {
    syncUserMock.mockImplementation(
      async (
        request:
          TenantAuthenticatedRequest,
      ) => {
        const users: Record<
          string,
          {
            id: string;
            email: string;
          }
        > = {
          'auth0|owner': {
            id: USER_IDS.owner,
            email:
              'owner@example.com',
          },
          'auth0|admin': {
            id: USER_IDS.admin,
            email:
              'admin@example.com',
          },
          'auth0|agent': {
            id: USER_IDS.agent,
            email:
              'agent@example.com',
          },
          'auth0|viewer': {
            id: USER_IDS.viewer,
            email:
              'viewer@example.com',
          },
          'auth0|invited': {
            id: USER_IDS.invited,
            email:
              'invited@example.com',
          },
        };

        return users[
          request.auth.sub
        ];
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

        const role =
          USER_ROLES[
            userId as keyof typeof USER_ROLES
          ];

        if (!role) {
          return null;
        }

        return {
          userId,
          organizationId,
          membershipId:
            `${role.toLowerCase()}-membership`,
          role,
        };
      },
    );

    const moduleRef =
      await Test.createTestingModule({
        controllers: [
          MembersController,
          InvitationsController,
          InvitationAcceptanceController,
        ],
        providers: [
          Reflector,
          PermissionsService,
          PermissionGuard,
          TenantMembershipGuard,
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
          {
            provide: MembersService,
            useValue: {
              listForOrganization:
                listMembersMock,
              updateRole:
                updateMemberRoleMock,
            },
          },
          {
            provide:
              InvitationsService,
            useValue: {
              create:
                createInvitationMock,
              list:
                listInvitationsMock,
              cancel:
                cancelInvitationMock,
              accept:
                acceptInvitationMock,
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

    listMembersMock.mockResolvedValue(
      [],
    );
    updateMemberRoleMock.mockResolvedValue({
      id: MEMBERSHIP_ID,
      role: 'VIEWER',
    });
    createInvitationMock.mockResolvedValue({
      id: 'invitation-1',
      email: 'new@example.com',
      role: 'AGENT',
      status: 'PENDING',
    });
    listInvitationsMock.mockResolvedValue(
      [],
    );
    cancelInvitationMock.mockResolvedValue({
      id: 'invitation-1',
      status: 'CANCELED',
    });
    acceptInvitationMock.mockResolvedValue({
      membership: {
        id: MEMBERSHIP_ID,
        role: 'AGENT',
      },
      organization: {
        id: ORG_A,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('members:read', () => {
    it.each([
      'owner',
      'admin',
      'agent',
      'viewer',
    ])(
      'allows %s to list members',
      async (role) => {
        await request(
          app.getHttpServer(),
        )
          .get(
            `/v1/organizations/${ORG_A}/members`,
          )
          .set(
            'Authorization',
            `Bearer ${role}-token`,
          )
          .expect(200);
      },
    );
  });

  describe('members:manage', () => {
    it.each([
      'owner',
      'admin',
    ])(
      'allows %s through the RBAC layer',
      async (role) => {
        await request(
          app.getHttpServer(),
        )
          .patch(
            `/v1/organizations/${ORG_A}/members/${MEMBERSHIP_ID}/role`,
          )
          .set(
            'Authorization',
            `Bearer ${role}-token`,
          )
          .send({ role: 'VIEWER' })
          .expect(200);

        expect(
          updateMemberRoleMock,
        ).toHaveBeenCalled();
      },
    );

    it.each([
      'agent',
      'viewer',
    ])(
      'rejects %s from managing members',
      async (role) => {
        await request(
          app.getHttpServer(),
        )
          .patch(
            `/v1/organizations/${ORG_A}/members/${MEMBERSHIP_ID}/role`,
          )
          .set(
            'Authorization',
            `Bearer ${role}-token`,
          )
          .send({ role: 'VIEWER' })
          .expect(403);

        expect(
          updateMemberRoleMock,
        ).not.toHaveBeenCalled();
      },
    );
  });

  it('blocks cross-tenant member access', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        `/v1/organizations/${ORG_B}/members`,
      )
      .set(
        'Authorization',
        'Bearer owner-token',
      )
      .expect(404);

    expect(
      listMembersMock,
    ).not.toHaveBeenCalled();
  });

  describe('invitations:manage', () => {
    it.each([
      'owner',
      'admin',
    ])(
      'allows %s to manage invitations',
      async (role) => {
        await request(
          app.getHttpServer(),
        )
          .post(
            `/v1/organizations/${ORG_A}/invitations`,
          )
          .set(
            'Authorization',
            `Bearer ${role}-token`,
          )
          .send({
            email: 'new@example.com',
            role: 'AGENT',
          })
          .expect(201);

        expect(
          createInvitationMock,
        ).toHaveBeenCalled();
      },
    );

    it.each([
      'agent',
      'viewer',
    ])(
      'rejects %s from managing invitations',
      async (role) => {
        await request(
          app.getHttpServer(),
        )
          .post(
            `/v1/organizations/${ORG_A}/invitations`,
          )
          .set(
            'Authorization',
            `Bearer ${role}-token`,
          )
          .send({
            email: 'new@example.com',
            role: 'AGENT',
          })
          .expect(403);

        expect(
          createInvitationMock,
        ).not.toHaveBeenCalled();
      },
    );
  });

  it('allows an authenticated non-member to accept an invitation', async () => {
    const token =
      'abcdefghijklmnopqrstuvwxyz1234567890';

    await request(
      app.getHttpServer(),
    )
      .post(
        '/v1/invitations/accept',
      )
      .set(
        'Authorization',
        'Bearer invited-token',
      )
      .send({ token })
      .expect(200);

    expect(
      acceptInvitationMock,
    ).toHaveBeenCalledWith(
      {
        id: USER_IDS.invited,
        email:
          'invited@example.com',
      },
      token,
    );

    expect(
      resolveTenantMock,
    ).not.toHaveBeenCalled();
  });
});
