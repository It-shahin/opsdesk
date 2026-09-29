import {
  ConfigService,
} from '@nestjs/config';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  InboundEmailProviderService,
} from './inbound-email-provider.service.js';

import {
  InboundEmailService,
} from './inbound-email.service.js';

const TICKET_ID =
  '819f42f7-5181-4eb7-9f33-256c89ff6f4c';

const ORG_ID =
  '11111111-1111-4111-8111-111111111111';

describe(
  'InboundEmailService',
  () => {
    const getReceivedEmailMock =
      jest.fn();

    const ticketFindFirstMock =
      jest.fn();

    const txMessageCreateMock =
      jest.fn();

    const txTicketUpdateManyMock =
      jest.fn();

    const webhookEventFindFirstMock =
      jest.fn();

    const webhookEventCreateMock =
      jest.fn();

    const txWebhookEventCreateMock =
      jest.fn();

    const transactionClient = {
      ticketMessage: {
        create:
          txMessageCreateMock,
      },

      ticket: {
        updateMany:
          txTicketUpdateManyMock,
      },

      webhookEvent: {
        create:
          txWebhookEventCreateMock,
      },
    };

    const transactionMock =
      jest.fn(
        async (
          callback: (
            transaction:
              typeof transactionClient,
          ) => Promise<unknown>,
        ) => callback(
          transactionClient,
        ),
      );

    const prisma = {
      ticket: {
        findFirst:
          ticketFindFirstMock,
      },

      webhookEvent: {
        findFirst:
          webhookEventFindFirstMock,

        create:
          webhookEventCreateMock,
      },

      $transaction:
        transactionMock,
    };

    const provider = {
      getReceivedEmail:
        getReceivedEmailMock,
    };

    const config = {
      getOrThrow: (
        key: string,
      ) => {
        if (
          key ===
          'EMAIL_INBOUND_DOMAIN'
        ) {
          return 'abc.resend.app';
        }

        throw new Error(
          `Missing ${key}`,
        );
      },
    };

    let service:
      InboundEmailService;

    beforeEach(() => {
      jest.resetAllMocks();

      transactionMock
        .mockImplementation(
          async (callback) =>
            callback(
              transactionClient,
            ),
        );

      webhookEventFindFirstMock
        .mockResolvedValue(
          null,
        );

      webhookEventCreateMock
        .mockResolvedValue({
          id:
            'webhook-event-1',
        });

      txWebhookEventCreateMock
        .mockResolvedValue({
          id:
            'webhook-event-1',
        });

      service =
        new InboundEmailService(
          prisma as unknown as PrismaService,
          provider as unknown as InboundEmailProviderService,
          config as unknown as ConfigService,
        );
    });

    it(
      'creates exactly one message for a verified inbound email',
      async () => {
        getReceivedEmailMock
          .mockResolvedValue({
            from:
              'Jane <jane@example.com>',

            to: [
              `ticket-${TICKET_ID}@abc.resend.app`,
            ],

            text:
              'Thanks, but I still have the issue.',

            html:
              null,
          });

        ticketFindFirstMock
          .mockResolvedValue({
            id:
              TICKET_ID,

            organizationId:
              ORG_ID,

            status:
              'PENDING',

            customer: {
              email:
                'jane@example.com',
            },
          });

        txMessageCreateMock
          .mockResolvedValue({
            id:
              'message-1',

            ticketId:
              TICKET_ID,

            organizationId:
              ORG_ID,

            createdAt:
              new Date(),
          });

        txTicketUpdateManyMock
          .mockResolvedValue({
            count: 1,
          });

        const result =
          await service
            .handleReceivedEmail(
              {
                emailId:
                  'received-email-1',

                from:
                  'Jane <jane@example.com>',

                to: [
                  `ticket-${TICKET_ID}@abc.resend.app`,
                ],
              },

              {
                webhookMessageId:
                  'webhook-message-1',

                providerEntityId:
                  'received-email-1',

                eventType:
                  'email.received',
              },
            );

        expect(
          txWebhookEventCreateMock,
        ).toHaveBeenCalledWith({
          data: {
            provider:
              'RESEND',

            eventType:
              'email.received',

            providerEntityId:
              'received-email-1',

            webhookMessageId:
              'webhook-message-1',

            status:
              'PROCESSED',
          },
        });

        expect(
          txWebhookEventCreateMock
            .mock
            .invocationCallOrder[0],
        ).toBeLessThan(
          txMessageCreateMock
            .mock
            .invocationCallOrder[0],
        );

        expect(
          txMessageCreateMock,
        ).toHaveBeenCalledWith({
          data: {
            organizationId:
              ORG_ID,

            ticketId:
              TICKET_ID,

            authorMembershipId:
              null,

            kind:
              'PUBLIC_REPLY',

            authorType:
              'CUSTOMER',

            source:
              'EMAIL',

            body:
              'Thanks, but I still have the issue.',
          },

          select:
            expect.any(
              Object,
            ),
        });

        expect(
          txTicketUpdateManyMock,
        ).toHaveBeenCalledWith({
          where: {
            id:
              TICKET_ID,

            organizationId:
              ORG_ID,

            status: {
              in: [
                'PENDING',
                'RESOLVED',
                'CLOSED',
              ],
            },
          },

          data: {
            status:
              'OPEN',

            resolvedAt:
              null,

            closedAt:
              null,
          },
        });

        expect(result).toEqual({
          status:
            'created',

          messageId:
            'message-1',
        });
      },
    );

    it(
      'ignores an already processed inbound email',
      async () => {
        webhookEventFindFirstMock
          .mockResolvedValue({
            id:
              'event-id',
          });

        const result =
          await service
            .handleReceivedEmail(
              {
                emailId:
                  'resend-email-123',

                from:
                  'jane@example.com',

                to: [
                  `ticket-${TICKET_ID}@abc.resend.app`,
                ],
              },

              {
                webhookMessageId:
                  'another-svix-id',

                providerEntityId:
                  'resend-email-123',

                eventType:
                  'email.received',
              },
            );

        expect(
          result.status,
        ).toBe(
          'duplicate',
        );

        expect(
          getReceivedEmailMock,
        ).not.toHaveBeenCalled();

        expect(
          txMessageCreateMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'ignores email from a sender other than the ticket customer',
      async () => {
        getReceivedEmailMock
          .mockResolvedValue({
            from:
              'attacker@example.com',

            to: [
              `ticket-${TICKET_ID}@abc.resend.app`,
            ],

            text:
              'Malicious reply.',

            html:
              null,
          });

        ticketFindFirstMock
          .mockResolvedValue({
            id:
              TICKET_ID,

            organizationId:
              ORG_ID,

            status:
              'PENDING',

            customer: {
              email:
                'jane@example.com',
            },
          });

        const result =
          await service
            .handleReceivedEmail(
              {
                emailId:
                  'received-email-2',

                from:
                  'attacker@example.com',

                to: [
                  `ticket-${TICKET_ID}@abc.resend.app`,
                ],
              },

              {
                webhookMessageId:
                  'webhook-message-2',

                providerEntityId:
                  'received-email-2',

                eventType:
                  'email.received',
              },
            );

        expect(result).toEqual({
          status:
            'ignored',

          reason:
            'sender-mismatch',
        });

        expect(
          txMessageCreateMock,
        ).not.toHaveBeenCalled();

        expect(
          transactionMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'handles concurrent duplicate webhook claims',
      async () => {
        getReceivedEmailMock
          .mockResolvedValue({
            from:
              'Jane <jane@example.com>',

            to: [
              `ticket-${TICKET_ID}@abc.resend.app`,
            ],

            text:
              'Repeated delivery.',

            html:
              null,
          });

        ticketFindFirstMock
          .mockResolvedValue({
            id:
              TICKET_ID,

            organizationId:
              ORG_ID,

            status:
              'PENDING',

            customer: {
              email:
                'jane@example.com',
            },
          });

        txWebhookEventCreateMock
          .mockRejectedValue({
            code:
              'P2002',
          });

        const result =
          await service
            .handleReceivedEmail(
              {
                emailId:
                  'received-email-3',

                from:
                  'Jane <jane@example.com>',

                to: [
                  `ticket-${TICKET_ID}@abc.resend.app`,
                ],
              },

              {
                webhookMessageId:
                  'webhook-message-3',

                providerEntityId:
                  'received-email-3',

                eventType:
                  'email.received',
              },
            );

        expect(result).toEqual({
          status:
            'duplicate',
        });

        expect(
          txMessageCreateMock,
        ).not.toHaveBeenCalled();

        expect(
          txTicketUpdateManyMock,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
