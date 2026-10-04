import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  ConfigService,
} from '@nestjs/config';

import {
  Test,
} from '@nestjs/testing';

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

import {
  RealtimePublisherModule,
} from '../src/realtime/realtime-publisher.module.js';

import {
  IS_PUBLIC_KEY,
} from '../src/auth/public.decorator.js';

import {
  PrismaService,
} from '../src/database/prisma.service.js';

import {
  InboundEmailProviderService,
} from '../src/email/inbound-email-provider.service.js';

import {
  InboundEmailService,
} from '../src/email/inbound-email.service.js';

import {
  OutboundEmailEventsService,
} from '../src/email/outbound-email-events.service.js';

import {
  ResendWebhookController,
} from '../src/email/resend-webhook.controller.js';

import {
  ResendWebhookVerificationService,
} from '../src/email/resend-webhook-verification.service.js';

import {
  JobsService,
} from '../src/jobs/jobs.service.js';

import {
  PermissionGuard,
} from '../src/rbac/permission.guard.js';

import {
  PermissionsService,
} from '../src/rbac/permissions.service.js';

import {
  TenantContextService,
} from '../src/tenancy/tenant-context.service.js';

import type {
  TenantAuthenticatedRequest,
} from '../src/tenancy/tenant-context.types.js';

import {
  TenantMembershipGuard,
} from '../src/tenancy/tenant-membership.guard.js';

import {
  TicketsController,
} from '../src/tickets/tickets.controller.js';

import {
  TicketsService,
} from '../src/tickets/tickets.service.js';

import {
  UsersService,
} from '../src/users/users.service.js';

const ORG_A =
  '11111111-1111-4111-8111-111111111111';

const ORG_B =
  '22222222-2222-4222-8222-222222222222';

const TICKET_A =
  '33333333-3333-4333-8333-333333333333';

const MESSAGE_A =
  '44444444-4444-4444-8444-444444444444';

const DELIVERY_A =
  '55555555-5555-4555-8555-555555555555';

const AGENT_USER =
  '66666666-6666-4666-8666-666666666666';

const VIEWER_USER =
  '77777777-7777-4777-8777-777777777777';

const ORG_B_USER =
  '88888888-8888-4888-8888-888888888888';

@Injectable()
class TestAuthGuard
  implements CanActivate
{
  constructor(
    private readonly reflector:
      Reflector,
  ) {}

  canActivate(
    context:
      ExecutionContext,
  ): boolean {
    const isPublic =
      this.reflector
        .getAllAndOverride<boolean>(
          IS_PUBLIC_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    if (isPublic) {
      return true;
    }

    const httpRequest =
      context
        .switchToHttp()
        .getRequest<TenantAuthenticatedRequest>();

    const identities: Record<
      string,
      string
    > = {
      'Bearer agent-token':
        'auth0|agent',

      'Bearer viewer-token':
        'auth0|viewer',

      'Bearer org-b-token':
        'auth0|org-b-agent',
    };

    const authorization =
      httpRequest.headers
        .authorization;

    const sub =
      authorization
        ? identities[
            authorization
          ]
        : undefined;

    if (!sub) {
      throw new UnauthorizedException();
    }

    httpRequest.auth = {
      sub,
    };

    httpRequest.accessToken =
      authorization.replace(
        'Bearer ',
        '',
      );

    return true;
  }
}

describe(
  'Email HTTP integration',
  () => {
    let app:
      INestApplication;

    let inboundEmail:
      InboundEmailService;

    let outboundEmailEvents:
      OutboundEmailEventsService;

    const syncUserMock =
      jest.fn();

    const resolveTenantMock =
      jest.fn();

    const txTicketFindFirstMock =
      jest.fn();

    const txMessageCreateMock =
      jest.fn();

    const txMessageFindFirstMock =
      jest.fn();

    const txEmailDeliveryCreateMock =
      jest.fn();

    const txEmailDeliveryUpdateManyMock =
      jest.fn();

    const txWebhookEventCreateMock =
      jest.fn();

    const ensureEmailDeliveryQueuedMock =
      jest.fn();

    const verifyWebhookMock =
      jest.fn();

    const providerGetEmailMock =
      jest.fn();

    const webhookEventFindFirstMock =
      jest.fn();

    const emailDeliveryFindUniqueMock =
      jest.fn();

    const transactionClient = {
      ticket: {
        findFirst:
          txTicketFindFirstMock,

        updateMany:
          jest.fn(),
      },

      ticketMessage: {
        create:
          txMessageCreateMock,

        findFirst:
          txMessageFindFirstMock,
      },

      attachment: {
        findMany:
          jest.fn(),

        updateMany:
          jest.fn(),
      },

      emailDelivery: {
        create:
          txEmailDeliveryCreateMock,

        updateMany:
          txEmailDeliveryUpdateManyMock,
      },

      webhookEvent: {
        create:
          txWebhookEventCreateMock,
      },
    };

    type TransactionCallback =
      (
        transaction:
          typeof transactionClient,
      ) => Promise<unknown>;

    const transactionMock =
      jest.fn<
        (
          callback:
            TransactionCallback,
        ) => Promise<unknown>
      >();

    beforeAll(
      async () => {
        const prisma = {
          webhookEvent: {
            findFirst:
              webhookEventFindFirstMock,
          },

          ticket: {
            findFirst:
              jest.fn(),
          },

          emailDelivery: {
            findUnique:
              emailDeliveryFindUniqueMock,
          },

          $transaction:
            transactionMock,
        };

        const moduleRef =
          await Test
            .createTestingModule({
              imports: [
                RealtimePublisherModule,
              ],
              controllers: [
                TicketsController,
                ResendWebhookController,
              ],

              providers: [
                Reflector,
                PermissionsService,
                PermissionGuard,
                TenantMembershipGuard,
                TicketsService,
                InboundEmailService,
                OutboundEmailEventsService,

                {
                  provide:
                    PrismaService,

                  useValue:
                    prisma,
                },

                {
                  provide:
                    JobsService,

                  useValue: {
                    ensureEmailDeliveryQueued:
                      ensureEmailDeliveryQueuedMock,
                  },
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
                  provide:
                    UsersService,

                  useValue: {
                    syncAuthenticatedUser:
                      syncUserMock,
                  },
                },

                {
                  provide:
                    InboundEmailProviderService,

                  useValue: {
                    getReceivedEmail:
                      providerGetEmailMock,
                  },
                },

                {
                  provide:
                    ResendWebhookVerificationService,

                  useValue: {
                    verify:
                      verifyWebhookMock,
                  },
                },

                {
                  provide:
                    ConfigService,

                  useValue: {
                    getOrThrow: () =>
                      'inbound.resend.app',
                  },
                },
              ],
            })
            .compile();

        inboundEmail =
          moduleRef.get(
            InboundEmailService,
          );

        outboundEmailEvents =
          moduleRef.get(
            OutboundEmailEventsService,
          );

        app =
          moduleRef
            .createNestApplication({
              rawBody:
                true,
            });

        app.useGlobalGuards(
          new TestAuthGuard(
            moduleRef.get(
              Reflector,
            ),
          ),
        );

        app.useGlobalPipes(
          new ValidationPipe({
            whitelist:
              true,

            forbidNonWhitelisted:
              true,

            transform:
              true,
          }),
        );

        await app.init();
      },
    );

    beforeEach(() => {
      jest.resetAllMocks();

      syncUserMock
        .mockImplementation(
          async (
            authenticatedRequest:
              TenantAuthenticatedRequest,
          ) => {
            switch (
              authenticatedRequest
                .auth.sub
            ) {
              case 'auth0|agent':
                return {
                  id:
                    AGENT_USER,
                };

              case 'auth0|viewer':
                return {
                  id:
                    VIEWER_USER,
                };

              case 'auth0|org-b-agent':
                return {
                  id:
                    ORG_B_USER,
                };

              default:
                throw new Error(
                  'Unknown user',
                );
            }
          },
        );

      resolveTenantMock
        .mockImplementation(
          async (
            userId:
              string,
            organizationId:
              string,
          ) => {
            if (
              userId ===
                VIEWER_USER &&
              organizationId ===
                ORG_A
            ) {
              return {
                userId,
                organizationId,
                membershipId:
                  '99999999-9999-4999-8999-999999999999',
                role:
                  'VIEWER',
              };
            }

            if (
              userId ===
                ORG_B_USER &&
              organizationId ===
                ORG_B
            ) {
              return {
                userId,
                organizationId,
                membershipId:
                  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                role:
                  'AGENT',
              };
            }

            if (
              userId ===
                AGENT_USER &&
              organizationId ===
                ORG_A
            ) {
              return {
                userId,
                organizationId,
                membershipId:
                  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                role:
                  'AGENT',
              };
            }

            return null;
          },
        );

      transactionMock
        .mockImplementation(
          async (
            callback,
          ) =>
            callback(
              transactionClient,
            ),
        );

      txTicketFindFirstMock
        .mockResolvedValue({
          id:
            TICKET_A,

          status:
            'OPEN',

          customer: {
            email:
              'customer@example.com',
          },
        });

      txMessageCreateMock
        .mockResolvedValue({
          id:
            MESSAGE_A,
        });

      txMessageFindFirstMock
        .mockResolvedValue({
          id:
            MESSAGE_A,

          kind:
            'PUBLIC_REPLY',

          authorType:
            'MEMBER',

          source:
            'MANUAL',

          body:
            'Hello customer.',

          attachments: [],

          emailDelivery:
            null,
        });

      txEmailDeliveryCreateMock
        .mockResolvedValue({
          id:
            DELIVERY_A,

          status:
            'PENDING',
        });

      ensureEmailDeliveryQueuedMock
        .mockResolvedValue(
          undefined,
        );
    });

    afterAll(
      async () => {
        await app?.close();
      },
    );

    const messagesUrl =
      `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/messages`;

    it(
      'persists and queues a public reply after the transaction',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .post(
            messagesUrl,
          )
          .set(
            'Authorization',
            'Bearer agent-token',
          )
          .send({
            kind:
              'PUBLIC_REPLY',

            body:
              'Hello customer.',
          })
          .expect(201);

        expect(
          txEmailDeliveryCreateMock,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining({
                organizationId:
                  ORG_A,

                ticketId:
                  TICKET_A,

                messageId:
                  MESSAGE_A,

                recipientEmail:
                  'customer@example.com',

                status:
                  'PENDING',
              }),
          }),
        );

        expect(
          ensureEmailDeliveryQueuedMock,
        ).toHaveBeenCalledWith(
          DELIVERY_A,
        );

        expect(
          txEmailDeliveryCreateMock
            .mock.invocationCallOrder[0],
        ).toBeLessThan(
          ensureEmailDeliveryQueuedMock
            .mock.invocationCallOrder[0],
        );
      },
    );

    it(
      'never creates or queues a delivery for an internal note',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .post(
            messagesUrl,
          )
          .set(
            'Authorization',
            'Bearer agent-token',
          )
          .send({
            kind:
              'INTERNAL_NOTE',

            body:
              'Internal only.',
          })
          .expect(201);

        expect(
          txEmailDeliveryCreateMock,
        ).not.toHaveBeenCalled();

        expect(
          ensureEmailDeliveryQueuedMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'keeps durable email intent when queueing fails',
      async () => {
        ensureEmailDeliveryQueuedMock
          .mockRejectedValue(
            new Error(
              'Redis unavailable',
            ),
          );

        await request(
          app.getHttpServer(),
        )
          .post(
            messagesUrl,
          )
          .set(
            'Authorization',
            'Bearer agent-token',
          )
          .send({
            kind:
              'PUBLIC_REPLY',

            body:
              'Persist this reply.',
          })
          .expect(201);

        expect(
          txEmailDeliveryCreateMock,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining({
                status:
                  'PENDING',
              }),
          }),
        );
      },
    );

    it(
      'forbids a viewer from creating a public reply',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .post(
            messagesUrl,
          )
          .set(
            'Authorization',
            'Bearer viewer-token',
          )
          .send({
            kind:
              'PUBLIC_REPLY',

            body:
              'Not allowed.',
          })
          .expect(403);

        expect(
          txEmailDeliveryCreateMock,
        ).not.toHaveBeenCalled();

        expect(
          ensureEmailDeliveryQueuedMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'does not create email intent for a cross-tenant ticket',
      async () => {
        txTicketFindFirstMock
          .mockResolvedValueOnce(
            null,
          );

        await request(
          app.getHttpServer(),
        )
          .post(
            `/v1/organizations/${ORG_B}/tickets/${TICKET_A}/messages`,
          )
          .set(
            'Authorization',
            'Bearer org-b-token',
          )
          .send({
            kind:
              'PUBLIC_REPLY',

            body:
              'Cross tenant.',
          })
          .expect(404);

        expect(
          txMessageCreateMock,
        ).not.toHaveBeenCalled();

        expect(
          txEmailDeliveryCreateMock,
        ).not.toHaveBeenCalled();

        expect(
          ensureEmailDeliveryQueuedMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects a forged webhook before business processing',
      async () => {
        const inboundSpy =
          jest.spyOn(
            inboundEmail,
            'handleReceivedEmail',
          );

        const outboundSpy =
          jest.spyOn(
            outboundEmailEvents,
            'handle',
          );

        verifyWebhookMock
          .mockRejectedValue(
            new BadRequestException(
              'Invalid webhook signature',
            ),
          );

        await request(
          app.getHttpServer(),
        )
          .post(
            '/v1/webhooks/resend',
          )
          .set(
            'svix-id',
            'fake-id',
          )
          .set(
            'svix-timestamp',
            '123',
          )
          .set(
            'svix-signature',
            'fake-signature',
          )
          .send({
            type:
              'email.received',

            data: {
              email_id:
                'fake-email',
            },
          })
          .expect(400);

        expect(
          inboundSpy,
        ).not.toHaveBeenCalled();

        expect(
          outboundSpy,
        ).not.toHaveBeenCalled();

        inboundSpy.mockRestore();
        outboundSpy.mockRestore();
      },
    );

    it(
      'requires all Svix headers',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .post(
            '/v1/webhooks/resend',
          )
          .send({
            type:
              'email.received',
          })
          .expect(400);

        expect(
          verifyWebhookMock,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
