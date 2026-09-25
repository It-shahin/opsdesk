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

import { PrismaService } from '../src/database/prisma.service.js';
import { PermissionGuard } from '../src/rbac/permission.guard.js';
import { PermissionsService } from '../src/rbac/permissions.service.js';
import { TenantContextService } from '../src/tenancy/tenant-context.service.js';
import type { TenantAuthenticatedRequest } from '../src/tenancy/tenant-context.types.js';
import { TenantMembershipGuard } from '../src/tenancy/tenant-membership.guard.js';
import { TicketsController } from '../src/tickets/tickets.controller.js';
import { TicketsService } from '../src/tickets/tickets.service.js';
import { UsersService } from '../src/users/users.service.js';

const ORG_A =
  '11111111-1111-4111-8111-111111111111';
const ORG_B =
  '22222222-2222-4222-8222-222222222222';
const CUSTOMER_A =
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TICKET_A =
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const AGENT_MEMBERSHIP =
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OWNER_MEMBERSHIP =
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const VIEWER_MEMBERSHIP =
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TAG_A =
  'ffffffff-ffff-4fff-8fff-ffffffffffff';
const FOREIGN_CUSTOMER =
  '33333333-3333-4333-8333-333333333333';
const FOREIGN_TICKET =
  '44444444-4444-4444-8444-444444444444';
const FOREIGN_MEMBERSHIP =
  '55555555-5555-4555-8555-555555555555';
const FOREIGN_TAG =
  '66666666-6666-4666-8666-666666666666';

const USERS = {
  owner: {
    id:
      '10000000-0000-4000-8000-000000000001',
    sub: 'auth0|owner',
    email: 'owner@example.com',
    membershipId:
      OWNER_MEMBERSHIP,
    role: 'OWNER',
  },
  agent: {
    id:
      '10000000-0000-4000-8000-000000000002',
    sub: 'auth0|agent',
    email: 'agent@example.com',
    membershipId:
      AGENT_MEMBERSHIP,
    role: 'AGENT',
  },
  viewer: {
    id:
      '10000000-0000-4000-8000-000000000003',
    sub: 'auth0|viewer',
    email: 'viewer@example.com',
    membershipId:
      VIEWER_MEMBERSHIP,
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

describe('Tickets HTTP security', () => {
  let app: INestApplication;

  const syncUserMock = jest.fn();
  const resolveTenantMock = jest.fn();
  const customerFindFirstMock =
    jest.fn();
  const ticketCreateMock = jest.fn();
  const ticketFindManyMock = jest.fn();
  const ticketCountMock = jest.fn();
  const ticketFindFirstMock = jest.fn();
  const ticketUpdateMock = jest.fn();
  const membershipFindFirstMock =
    jest.fn();
  const tagFindFirstMock = jest.fn();
  const ticketTagUpsertMock =
    jest.fn();
  const ticketTagDeleteManyMock =
    jest.fn();
  const txTicketMessageCreateMock =
    jest.fn();
  const txTicketMessageFindFirstMock =
    jest.fn();
  const ticketMessageFindManyMock =
    jest.fn();
  const txTicketFindFirstMock =
    jest.fn();
  const txTicketUpdateManyMock =
    jest.fn();

  const transactionClient = {
    ticket: {
      findFirst:
        txTicketFindFirstMock,
      updateMany:
        txTicketUpdateManyMock,
    },
    ticketMessage: {
      create:
        txTicketMessageCreateMock,
      findFirst:
        txTicketMessageFindFirstMock,
    },
  };

  type TransactionCallback = (
    transaction:
      typeof transactionClient,
  ) => Promise<unknown>;

  type TransactionInput =
    | Promise<unknown>[]
    | TransactionCallback;

  const transactionMock =
    jest.fn<
      (
        input: TransactionInput,
      ) => Promise<unknown>
    >();

  const baseTicket = {
    id: TICKET_A,
    subject: 'Cannot login',
    description:
      'Customer cannot access the dashboard.',
    status: 'OPEN',
    priority: 'HIGH',
    source: 'MANUAL',
    resolvedAt: null,
    closedAt: null,
    createdAt: new Date(
      '2026-09-20T10:00:00.000Z',
    ),
    updatedAt: new Date(
      '2026-09-20T10:00:00.000Z',
    ),
    customer: {
      id: CUSTOMER_A,
      name: 'Jane Doe',
      email: 'jane@example.com',
      company: 'Acme',
    },
    assignee: null,
    tagLinks: [],
  };

  beforeAll(async () => {
    syncUserMock.mockImplementation(
      async (
        authenticatedRequest:
          TenantAuthenticatedRequest,
      ) => {
        const user =
          Object.values(USERS).find(
            (candidate) =>
              candidate.sub ===
              authenticatedRequest.auth.sub,
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
            user.membershipId,
          role: user.role,
        };
      },
    );

    const prisma = {
      customer: {
        findFirst:
          customerFindFirstMock,
      },
      ticket: {
        create: ticketCreateMock,
        findMany:
          ticketFindManyMock,
        count: ticketCountMock,
        findFirst:
          ticketFindFirstMock,
        update: ticketUpdateMock,
      },
      membership: {
        findFirst:
          membershipFindFirstMock,
      },
      tag: {
        findFirst:
          tagFindFirstMock,
      },
      ticketTag: {
        upsert:
          ticketTagUpsertMock,
        deleteMany:
          ticketTagDeleteManyMock,
      },
      ticketMessage: {
        create:
          txTicketMessageCreateMock,
        findMany:
          ticketMessageFindManyMock,
      },
      $transaction:
        transactionMock,
    };

    const moduleRef =
      await Test.createTestingModule({
        controllers: [
          TicketsController,
        ],
        providers: [
          Reflector,
          PermissionsService,
          PermissionGuard,
          TenantMembershipGuard,
          TicketsService,
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
        forbidNonWhitelisted:
          true,
        transform: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    ticketFindManyMock
      .mockResolvedValue([]);
    ticketCountMock
      .mockResolvedValue(0);
    ticketMessageFindManyMock
      .mockResolvedValue([]);

    transactionMock.mockImplementation(
      async (input) => {
        if (Array.isArray(input)) {
          return Promise.all(input);
        }

        return input(
          transactionClient,
        );
      },
    );

    txTicketMessageFindFirstMock
      .mockResolvedValue({
        id: 'message-1',
        authorType: 'MEMBER',
        attachments: [],
      });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get(
        `/v1/organizations/${ORG_A}/tickets`,
      )
      .expect(401);
  });

  it('allows a viewer to read tickets', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          `/v1/organizations/${ORG_A}/tickets`,
        )
        .set(
          'Authorization',
          'Bearer viewer-token',
        )
        .expect(200);

    expect(
      response.body.pagination,
    ).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('allows a viewer to read a ticket', async () => {
    ticketFindFirstMock
      .mockResolvedValue({
        ...baseTicket,
      });

    await request(app.getHttpServer())
      .get(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}`,
      )
      .set(
        'Authorization',
        'Bearer viewer-token',
      )
      .expect(200);
  });

  it('prevents a viewer from creating tickets', async () => {
    await request(app.getHttpServer())
      .post(
        `/v1/organizations/${ORG_A}/tickets`,
      )
      .set(
        'Authorization',
        'Bearer viewer-token',
      )
      .send({
        customerId: CUSTOMER_A,
        subject: 'Forbidden ticket',
      })
      .expect(403);

    expect(
      customerFindFirstMock,
    ).not.toHaveBeenCalled();
    expect(
      ticketCreateMock,
    ).not.toHaveBeenCalled();
  });

  it('prevents a viewer from modifying tickets', async () => {
    await request(app.getHttpServer())
      .patch(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}`,
      )
      .set(
        'Authorization',
        'Bearer viewer-token',
      )
      .send({
        priority: 'URGENT',
      })
      .expect(403);

    expect(
      ticketUpdateMock,
    ).not.toHaveBeenCalled();
  });

  it('prevents a viewer from posting messages', async () => {
    await request(app.getHttpServer())
      .post(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/messages`,
      )
      .set(
        'Authorization',
        'Bearer viewer-token',
      )
      .send({
        kind: 'PUBLIC_REPLY',
        body: 'Not allowed',
      })
      .expect(403);

    expect(
      txTicketMessageCreateMock,
    ).not.toHaveBeenCalled();
  });

  it('allows an agent to create a ticket', async () => {
    customerFindFirstMock
      .mockResolvedValue({
        id: CUSTOMER_A,
      });
    ticketCreateMock
      .mockResolvedValue({
        ...baseTicket,
      });

    await request(app.getHttpServer())
      .post(
        `/v1/organizations/${ORG_A}/tickets`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        customerId: CUSTOMER_A,
        subject: 'Cannot login',
        priority: 'HIGH',
      })
      .expect(201);

    expect(
      customerFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CUSTOMER_A,
          organizationId: ORG_A,
          archivedAt: null,
        },
      }),
    );
    expect(
      ticketCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data:
          expect.objectContaining({
            organizationId: ORG_A,
            customerId: CUSTOMER_A,
            status: 'OPEN',
            source: 'MANUAL',
          }),
      }),
    );
  });

  it('blocks access through another organization', async () => {
    await request(app.getHttpServer())
      .get(
        `/v1/organizations/${ORG_B}/tickets`,
      )
      .set(
        'Authorization',
        'Bearer owner-token',
      )
      .expect(404);

    expect(
      ticketFindManyMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects a customer from another tenant', async () => {
    customerFindFirstMock
      .mockResolvedValue(null);

    await request(app.getHttpServer())
      .post(
        `/v1/organizations/${ORG_A}/tickets`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        customerId:
          FOREIGN_CUSTOMER,
        subject:
          'Cross tenant attempt',
      })
      .expect(404);

    expect(
      customerFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: FOREIGN_CUSTOMER,
          organizationId: ORG_A,
          archivedAt: null,
        },
      }),
    );
    expect(
      ticketCreateMock,
    ).not.toHaveBeenCalled();
  });

  it('does not expose a ticket from another tenant', async () => {
    ticketFindFirstMock
      .mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(
        `/v1/organizations/${ORG_A}/tickets/${FOREIGN_TICKET}`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .expect(404);

    expect(
      ticketFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: FOREIGN_TICKET,
          organizationId: ORG_A,
        },
      }),
    );
  });

  it('resolves an open ticket', async () => {
    txTicketFindFirstMock
      .mockResolvedValueOnce({
        id: TICKET_A,
        status: 'OPEN',
      })
      .mockResolvedValueOnce({
        ...baseTicket,
        status: 'RESOLVED',
        resolvedAt: new Date(),
        closedAt: null,
      });
    txTicketUpdateManyMock
      .mockResolvedValue({
        count: 1,
      });

    const response =
      await request(app.getHttpServer())
        .patch(
          `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/status`,
        )
        .set(
          'Authorization',
          'Bearer agent-token',
        )
        .send({
          status: 'RESOLVED',
        })
        .expect(200);

    expect(response.body.status).toBe(
      'RESOLVED',
    );
    expect(
      txTicketUpdateManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: TICKET_A,
          organizationId: ORG_A,
          status: 'OPEN',
        },
        data:
          expect.objectContaining({
            status: 'RESOLVED',
            resolvedAt:
              expect.any(Date),
            closedAt: null,
          }),
      }),
    );
  });

  it('rejects an invalid OPEN to CLOSED transition', async () => {
    txTicketFindFirstMock
      .mockResolvedValue({
        id: TICKET_A,
        status: 'OPEN',
      });

    await request(app.getHttpServer())
      .patch(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/status`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        status: 'CLOSED',
      })
      .expect(409);

    expect(
      txTicketUpdateManyMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects status changes through the general ticket PATCH', async () => {
    await request(app.getHttpServer())
      .patch(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        status: 'CLOSED',
      })
      .expect(400);

    expect(
      ticketUpdateMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects an assignee from another tenant', async () => {
    ticketFindFirstMock
      .mockResolvedValue({
        id: TICKET_A,
      });
    membershipFindFirstMock
      .mockResolvedValue(null);

    await request(app.getHttpServer())
      .patch(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/assignee`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        membershipId:
          FOREIGN_MEMBERSHIP,
      })
      .expect(404);

    expect(
      membershipFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: FOREIGN_MEMBERSHIP,
          organizationId: ORG_A,
        },
      }),
    );
    expect(
      ticketUpdateMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects a tag from another tenant', async () => {
    ticketFindFirstMock
      .mockResolvedValue({
        id: TICKET_A,
      });
    tagFindFirstMock
      .mockResolvedValue(null);

    await request(app.getHttpServer())
      .post(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/tags/${FOREIGN_TAG}`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .expect(404);

    expect(
      tagFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: FOREIGN_TAG,
          organizationId: ORG_A,
        },
      }),
    );
    expect(
      ticketTagUpsertMock,
    ).not.toHaveBeenCalled();
  });

  it('allows an agent to attach a same-tenant tag', async () => {
    ticketFindFirstMock
      .mockResolvedValueOnce({
        id: TICKET_A,
      })
      .mockResolvedValueOnce({
        ...baseTicket,
        tagLinks: [
          {
            tag: {
              id: TAG_A,
              name: 'Bug',
            },
          },
        ],
      });
    tagFindFirstMock
      .mockResolvedValue({
        id: TAG_A,
      });
    ticketTagUpsertMock
      .mockResolvedValue({});

    const response =
      await request(app.getHttpServer())
        .post(
          `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/tags/${TAG_A}`,
        )
        .set(
          'Authorization',
          'Bearer agent-token',
        )
        .expect(200);

    expect(response.body.tags).toEqual([
      {
        id: TAG_A,
        name: 'Bug',
      },
    ]);
  });

  it('creates a member-authored public reply using trusted tenant identity', async () => {
    txTicketFindFirstMock
      .mockResolvedValue({
        id: TICKET_A,
        status: 'OPEN',
      });
    txTicketMessageCreateMock
      .mockResolvedValue({
        id: 'message-1',
        kind: 'PUBLIC_REPLY',
        authorType: 'MEMBER',
        source: 'MANUAL',
        body:
          'We are investigating this issue.',
      });

    await request(app.getHttpServer())
      .post(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/messages`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        kind: 'PUBLIC_REPLY',
        body:
          'We are investigating this issue.',
      })
      .expect(201);

    expect(
      txTicketMessageCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId: ORG_A,
          ticketId: TICKET_A,
          authorMembershipId:
            AGENT_MEMBERSHIP,
          kind: 'PUBLIC_REPLY',
          authorType: 'MEMBER',
          source: 'MANUAL',
          body:
            'We are investigating this issue.',
        },
      }),
    );
  });

  it('rejects attempts to spoof the message author or source', async () => {
    await request(app.getHttpServer())
      .post(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/messages`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        kind: 'PUBLIC_REPLY',
        body: 'Fake customer message',
        authorType: 'CUSTOMER',
        source: 'EMAIL',
      })
      .expect(400);

    expect(
      txTicketMessageCreateMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects public replies on closed tickets', async () => {
    txTicketFindFirstMock
      .mockResolvedValue({
        id: TICKET_A,
        status: 'CLOSED',
      });

    await request(app.getHttpServer())
      .post(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/messages`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        kind: 'PUBLIC_REPLY',
        body: 'Should fail',
      })
      .expect(409);

    expect(
      txTicketMessageCreateMock,
    ).not.toHaveBeenCalled();
  });

  it('allows internal notes on closed tickets', async () => {
    txTicketFindFirstMock
      .mockResolvedValue({
        id: TICKET_A,
        status: 'CLOSED',
      });
    txTicketMessageCreateMock
      .mockResolvedValue({
        id: 'message-1',
        kind: 'INTERNAL_NOTE',
        authorType: 'MEMBER',
        source: 'MANUAL',
        body: 'Post-resolution note.',
      });

    await request(app.getHttpServer())
      .post(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/messages`,
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .send({
        kind: 'INTERNAL_NOTE',
        body: 'Post-resolution note.',
      })
      .expect(201);
  });

  it('allows viewers to read ticket conversations', async () => {
    ticketFindFirstMock
      .mockResolvedValue({
        id: TICKET_A,
      });
    ticketMessageFindManyMock
      .mockResolvedValue([
        {
          id: 'message-2',
          body: 'Second',
        },
        {
          id: 'message-1',
          body: 'First',
        },
      ]);

    const response =
      await request(app.getHttpServer())
        .get(
          `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/messages`,
        )
        .set(
          'Authorization',
          'Bearer viewer-token',
        )
        .expect(200);

    expect(response.body).toEqual([
      {
        id: 'message-1',
        body: 'First',
      },
      {
        id: 'message-2',
        body: 'Second',
      },
    ]);
    expect(
      ticketMessageFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG_A,
          ticketId: TICKET_A,
        },
        take: 100,
      }),
    );
  });

  it('keeps combined inbox filters scoped to the tenant', async () => {
    await request(app.getHttpServer())
      .get(
        `/v1/organizations/${ORG_A}/tickets` +
          '?page=1' +
          '&limit=20' +
          '&search=jane' +
          '&status=OPEN' +
          '&priority=HIGH' +
          `&customerId=${CUSTOMER_A}` +
          `&assigneeMembershipId=${AGENT_MEMBERSHIP}` +
          `&tagId=${TAG_A}` +
          '&sortBy=updatedAt' +
          '&sortOrder=desc',
      )
      .set(
        'Authorization',
        'Bearer agent-token',
      )
      .expect(200);

    const call =
      ticketFindManyMock.mock
        .calls[0][0] as {
          where: {
            organizationId: string;
            status: string;
            priority: string;
            customerId: string;
            assigneeMembershipId:
              string;
            tagLinks: {
              some: {
                tagId: string;
              };
            };
            OR: unknown[];
          };
        };

    expect(
      call.where.organizationId,
    ).toBe(ORG_A);
    expect(call.where.status).toBe(
      'OPEN',
    );
    expect(call.where.priority).toBe(
      'HIGH',
    );
    expect(call.where.customerId).toBe(
      CUSTOMER_A,
    );
    expect(
      call.where.assigneeMembershipId,
    ).toBe(AGENT_MEMBERSHIP);
    expect(call.where.tagLinks).toEqual({
      some: {
        tagId: TAG_A,
      },
    });
    expect(call.where.OR).toEqual(
      expect.any(Array),
    );
  });

  it('returns correct pagination metadata', async () => {
    ticketFindManyMock
      .mockResolvedValue([
        {
          ...baseTicket,
        },
      ]);
    ticketCountMock
      .mockResolvedValue(25);

    const response =
      await request(app.getHttpServer())
        .get(
          `/v1/organizations/${ORG_A}/tickets?page=2&limit=10`,
        )
        .set(
          'Authorization',
          'Bearer agent-token',
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
      ticketFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where:
          expect.objectContaining({
            organizationId: ORG_A,
          }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it.each([
    ['page=0', 'invalid page'],
    ['limit=101', 'excessive limit'],
    ['status=INVALID', 'invalid status'],
    [
      'priority=SUPER_HIGH',
      'invalid priority',
    ],
    [
      'customerId=hello',
      'invalid customer UUID',
    ],
    [
      'sortBy=subject',
      'invalid sort field',
    ],
    [
      'sortOrder=random',
      'invalid sort order',
    ],
  ])(
    'rejects %s (%s)',
    async (query) => {
      await request(app.getHttpServer())
        .get(
          `/v1/organizations/${ORG_A}/tickets?${query}`,
        )
        .set(
          'Authorization',
          'Bearer agent-token',
        )
        .expect(400);

      expect(
        ticketFindManyMock,
      ).not.toHaveBeenCalled();
    },
  );
});
