import type { AuditService } from '../audit/audit.service.js';
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

import type {
  RealtimeService,
} from '../realtime/realtime.service.js';

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

    const publishMessageCreatedMock =
      jest.fn<RealtimeService['publishMessageCreated']>();

    const publishTicketUpdatedMock =
      jest.fn<RealtimeService['publishTicketUpdated']>();

    const realtime = {
      publishMessageCreated: publishMessageCreatedMock,
      publishTicketUpdated: publishTicketUpdatedMock,
    };

    const webhookEventFindFirstMock =
      jest.fn();

    const webhookEventCreateMock =
      jest.fn();

    const txWebhookEventCreateMock =
      jest.fn();

    const audit = {
      record: jest.fn<(...args: unknown[]) => ReturnType<AuditService['record']>>(),
      recordForTenant:
        jest.fn<
          (...args: unknown[]) => ReturnType<AuditService['recordForTenant']>
        >(),
    };

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
          realtime as unknown as RealtimeService,
          config as unknown as ConfigService,
          audit as unknown as AuditService,
        );
    });

    it.each([
      { ticketStatus: 'PENDING', reopenedCount: 1 },
      { ticketStatus: 'RESOLVED', reopenedCount: 1 },
      { ticketStatus: 'CLOSED', reopenedCount: 1 },
      { ticketStatus: 'OPEN', reopenedCount: 0 },
      { ticketStatus: 'PENDING', reopenedCount: 0 },
    ])(
      'creates one message for a $ticketStatus ticket with reopen count $reopenedCount',
      async ({ ticketStatus, reopenedCount }) => {
        const order: string[] = [];
        transactionMock.mockImplementationOnce(async (callback) => {
          const result = await callback(transactionClient);
          expect(publishMessageCreatedMock).not.toHaveBeenCalled();
          expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
          order.push('commit');
          return result;
        });
        publishMessageCreatedMock.mockImplementation(() => {
          order.push('message');
          return false;
        });
        publishTicketUpdatedMock.mockImplementation(() => {
          order.push('ticket');
          return false;
        });

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
              ticketStatus,

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
          .mockResolvedValueOnce({
            count: 1,
          })
          .mockResolvedValueOnce({
            count: reopenedCount,
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
        ).toHaveBeenCalledTimes(2);
        expect(txTicketUpdateManyMock).toHaveBeenNthCalledWith(1, {
          where: {
            id: TICKET_ID,
            organizationId: ORG_ID,
          },
          data: {
            updatedAt: expect.any(Date),
          },
        });
        expect(txMessageCreateMock.mock.invocationCallOrder[0]).toBeLessThan(
          txTicketUpdateManyMock.mock.invocationCallOrder[0],
        );
        expect(
          txTicketUpdateManyMock,
        ).toHaveBeenNthCalledWith(2, {
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
        expect(txMessageCreateMock).toHaveBeenCalledTimes(1);
        expect(audit.record).toHaveBeenCalledTimes(reopenedCount === 1 ? 2 : 1);
        expect(audit.record).toHaveBeenNthCalledWith(
          1,
          {
            organizationId: ORG_ID,
            action: 'TICKET_MESSAGE_CREATED',
            entityType: 'TICKET_MESSAGE',
            entityId: 'message-1',
            metadata: {
              ticketId: TICKET_ID,
              kind: 'PUBLIC_REPLY',
              source: 'EMAIL',
              authorType: 'CUSTOMER',
            },
          },
          transactionClient,
        );
        expect(audit.record.mock.calls[0]?.[1]).toBe(transactionClient);
        if (reopenedCount === 1) {
          expect(audit.record).toHaveBeenNthCalledWith(
            2,
            {
              organizationId: ORG_ID,
              action: 'TICKET_STATUS_CHANGED',
              entityType: 'TICKET',
              entityId: TICKET_ID,
              metadata: { to: 'OPEN', reason: 'CUSTOMER_REPLY' },
            },
            transactionClient,
          );
          expect(audit.record.mock.calls[1]?.[1]).toBe(transactionClient);
        }
        expect(publishMessageCreatedMock).toHaveBeenCalledTimes(1);
        expect(publishMessageCreatedMock).toHaveBeenCalledWith({
          organizationId: ORG_ID,
          ticketId: TICKET_ID,
          messageId: 'message-1',
        });
        if (reopenedCount === 1) {
          expect(publishTicketUpdatedMock).toHaveBeenCalledTimes(1);
          expect(publishTicketUpdatedMock).toHaveBeenCalledWith({
            organizationId: ORG_ID,
            ticketId: TICKET_ID,
          });
          expect(order).toEqual(['commit', 'message', 'ticket']);
        } else {
          expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
          expect(order).toEqual(['commit', 'message']);
        }
      },
    );

    it.each(['message', 'activity', 'message audit', 'reopen audit'] as const)(
      'does not publish inbound events when the %s write fails',
      async (failedWrite) => {
        const recipients = [`ticket-${TICKET_ID}@abc.resend.app`];
        getReceivedEmailMock.mockResolvedValue({
          from: 'jane@example.com',
          to: recipients,
          text: 'Customer reply.',
        });
        ticketFindFirstMock.mockResolvedValue({
          id: TICKET_ID,
          organizationId: ORG_ID,
          status: 'OPEN',
          customer: { email: 'jane@example.com' },
        });
        txMessageCreateMock.mockResolvedValue({ id: 'message-1' });
        txTicketUpdateManyMock.mockResolvedValue({ count: 1 });
        const error = new Error('Write failed');
        if (failedWrite === 'message') {
          txMessageCreateMock.mockRejectedValue(error);
        } else if (failedWrite === 'activity') {
          txTicketUpdateManyMock.mockRejectedValue(error);
        } else if (failedWrite === 'message audit') {
          audit.record.mockRejectedValue(error);
        } else {
          audit.record.mockResolvedValueOnce({ id: 'audit-1', createdAt: new Date() }).mockRejectedValueOnce(error);
        }

        await expect(service.handleReceivedEmail({
          emailId: 'received-email-1',
          from: 'jane@example.com',
          to: recipients,
        }, {
          webhookMessageId: 'webhook-message-1',
          providerEntityId: 'received-email-1',
          eventType: 'email.received',
        })).rejects.toBe(error);

        expect(txTicketUpdateManyMock).toHaveBeenCalledTimes(
          failedWrite === 'message' || failedWrite === 'message audit' ? 0
            : failedWrite === 'activity' ? 1 : 2,
        );
        expect(publishMessageCreatedMock).not.toHaveBeenCalled();
        expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
      },
    );

    it('does not publish inbound events if the transaction fails to commit', async () => {
      const recipients = [`ticket-${TICKET_ID}@abc.resend.app`];
      getReceivedEmailMock.mockResolvedValue({
        from: 'jane@example.com',
        to: recipients,
        text: 'Customer reply.',
      });
      ticketFindFirstMock.mockResolvedValue({
        id: TICKET_ID,
        organizationId: ORG_ID,
        status: 'RESOLVED',
        customer: { email: 'jane@example.com' },
      });
      txMessageCreateMock.mockResolvedValue({ id: 'message-1' });
      txTicketUpdateManyMock.mockResolvedValue({ count: 1 });
      const error = new Error('Commit failed');
      transactionMock.mockImplementationOnce(async (callback) => {
        await callback(transactionClient);
        throw error;
      });

      await expect(service.handleReceivedEmail({
        emailId: 'received-email-1',
        from: 'jane@example.com',
        to: recipients,
      }, {
        webhookMessageId: 'webhook-message-1',
        providerEntityId: 'received-email-1',
        eventType: 'email.received',
      })).rejects.toBe(error);

      expect(publishMessageCreatedMock).not.toHaveBeenCalled();
      expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
    });

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

        expect(publishMessageCreatedMock).not.toHaveBeenCalled();
        expect(publishTicketUpdatedMock).not.toHaveBeenCalled();

        expect(
          txMessageCreateMock,
        ).not.toHaveBeenCalled();
        expect(txTicketUpdateManyMock).not.toHaveBeenCalled();
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

        expect(publishMessageCreatedMock).not.toHaveBeenCalled();
        expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
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

        expect(publishMessageCreatedMock).not.toHaveBeenCalled();
        expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
      },
    );
  },
);
