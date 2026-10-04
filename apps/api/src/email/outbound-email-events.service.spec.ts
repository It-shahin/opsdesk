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
  OutboundEmailEventsService,
} from './outbound-email-events.service.js';

import type {
  RealtimeService,
} from '../realtime/realtime.service.js';

const DELIVERY_ID =
  '819f42f7-5181-4eb7-9f33-256c89ff6f4c';

const ORG_ID =
  '11111111-1111-4111-8111-111111111111';

const TICKET_ID =
  '22222222-2222-4222-8222-222222222222';

const MESSAGE_ID =
  '33333333-3333-4333-8333-333333333333';

describe(
  'OutboundEmailEventsService',
  () => {
    const deliveryFindUniqueMock =
      jest.fn();

    const txWebhookEventCreateMock =
      jest.fn();

    const txDeliveryUpdateManyMock =
      jest.fn();

    const publishEmailDeliveryUpdatedMock =
      jest.fn<RealtimeService['publishEmailDeliveryUpdated']>();

    const realtime = {
      publishEmailDeliveryUpdated: publishEmailDeliveryUpdatedMock,
    };

    const delivery = {
      id: DELIVERY_ID,
      organizationId: ORG_ID,
      ticketId: TICKET_ID,
      messageId: MESSAGE_ID,
      status: 'SENT',
      providerMessageId: null,
    };

    const transactionClient = {
      webhookEvent: {
        create:
          txWebhookEventCreateMock,
      },

      emailDelivery: {
        updateMany:
          txDeliveryUpdateManyMock,
      },
    };

    const transactionMock =
      jest.fn(
        async (
          callback:
            (
              tx:
                typeof transactionClient,
            ) => Promise<{ statusChanged: boolean }>,
        ) =>
          callback(
            transactionClient,
          ),
      );

    const prisma = {
      emailDelivery: {
        findUnique:
          deliveryFindUniqueMock,
      },

      $transaction:
        transactionMock,
    };

    let service:
      OutboundEmailEventsService;

    beforeEach(() => {
      jest.resetAllMocks();

      deliveryFindUniqueMock.mockResolvedValue(delivery);
      txDeliveryUpdateManyMock.mockResolvedValue({ count: 1 });
      publishEmailDeliveryUpdatedMock.mockReturnValue(false);

      transactionMock
        .mockImplementation(
          async (
            callback,
          ) =>
            callback(
              transactionClient,
            ),
        );

      service =
        new OutboundEmailEventsService(
          prisma as unknown as PrismaService,
          realtime as unknown as RealtimeService,
        );
    });

    it(
      'correlates a delivered event by tag and prevents terminal regression',
      async () => {
        let committed = false;
        transactionMock.mockImplementationOnce(async (callback) => {
          const result = await callback(transactionClient);
          expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
          committed = true;
          return result;
        });
        publishEmailDeliveryUpdatedMock.mockImplementation(() => {
          expect(committed).toBe(true);
          return false;
        });
        txDeliveryUpdateManyMock
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 });

        deliveryFindUniqueMock
          .mockResolvedValue({
            ...delivery,
            id:
              DELIVERY_ID,

            providerMessageId:
              null,
          });

        const result =
          await service.handle(
            'email.delivered',
            {
              emailId:
                'resend-email-1',

              tags: {
                opsdesk_delivery_id:
                  DELIVERY_ID,
              },
            },
            {
              webhookMessageId:
                'webhook-message-1',
            },
          );

        expect(
          deliveryFindUniqueMock,
        ).toHaveBeenCalledWith({
          where: {
            id:
              DELIVERY_ID,
          },
        });

        expect(
          txDeliveryUpdateManyMock,
        ).toHaveBeenNthCalledWith(
          1,
          {
            where: {
              id:
                DELIVERY_ID,

              OR: [
                {
                  providerMessageId:
                    null,
                },

                {
                  providerMessageId:
                    'resend-email-1',
                },
              ],
            },

            data: {
              providerMessageId:
                'resend-email-1',
            },
          },
        );

        expect(
          txDeliveryUpdateManyMock,
        ).toHaveBeenLastCalledWith({
          where: {
            id:
              DELIVERY_ID,

            status: {
              in: [
                'PENDING',
                'SENDING',
                'SENT',
                'DELAYED',
              ],
            },
          },

          data: {
            status:
              'DELIVERED',

            deliveredAt:
              expect.any(Date),
          },
        });

        expect(result).toEqual({
          status:
            'processed',
        });
        expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledTimes(1);
        expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledWith({
          organizationId: delivery.organizationId,
          ticketId: delivery.ticketId,
          messageId: delivery.messageId,
          emailDeliveryId: DELIVERY_ID,
          status: 'DELIVERED',
        });
      },
    );

    it(
      'falls back to the provider message ID when no delivery tag exists',
      async () => {
        deliveryFindUniqueMock
          .mockResolvedValue(null);

        await expect(
          service.handle(
            'email.sent',
            {
              emailId:
                'resend-email-2',
            },
            {
              webhookMessageId:
                'webhook-message-2',
            },
          ),
        ).resolves.toEqual({
          status:
            'ignored',
        });

        expect(
          deliveryFindUniqueMock,
        ).toHaveBeenCalledWith({
          where: {
            providerMessageId:
              'resend-email-2',
          },
        });

        expect(
          transactionMock,
        ).not.toHaveBeenCalled();
        expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        'email.sent',
        'SENT',
        [
          'PENDING',
          'SENDING',
        ],
        'sentAt',
      ],
      [
        'email.delivery_delayed',
        'DELAYED',
        [
          'PENDING',
          'SENDING',
          'SENT',
        ],
        null,
      ],
    ] as const)(
      'maps %s to %s',
      async (
        eventType,
        expectedStatus,
        allowedFrom,
        timestampField,
      ) => {
        deliveryFindUniqueMock
          .mockResolvedValue({
            ...delivery,
            status: 'SENDING',
            id:
              DELIVERY_ID,
          });

        await service.handle(
          eventType,
          {
            emailId:
              'resend-email-progress',

            tags: {
              opsdesk_delivery_id:
                DELIVERY_ID,
            },
          },
          {
            webhookMessageId:
              'webhook-message-progress',
          },
        );

        const data = {
          status:
            expectedStatus,

          ...(timestampField
            ? {
                [timestampField]:
                  expect.any(Date),
              }
            : {}),
        };

        expect(
          txDeliveryUpdateManyMock,
        ).toHaveBeenLastCalledWith({
          where: {
            id:
              DELIVERY_ID,

            status: {
              in:
                allowedFrom,
            },
          },

          data,
        });
        expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledTimes(1);
        expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledWith({
          organizationId: delivery.organizationId,
          ticketId: delivery.ticketId,
          messageId: delivery.messageId,
          emailDeliveryId: DELIVERY_ID,
          status: expectedStatus,
        });
      },
    );

    it.each([
      [
        'email.bounced',
        'BOUNCED',
      ],
      [
        'email.complained',
        'COMPLAINED',
      ],
      [
        'email.suppressed',
        'SUPPRESSED',
      ],
      [
        'email.failed',
        'FAILED',
      ],
    ] as const)(
      'maps %s to %s without allowing terminal-state regression',
      async (
        eventType,
        expectedStatus,
      ) => {
        deliveryFindUniqueMock
          .mockResolvedValue({
            ...delivery,
            id:
              DELIVERY_ID,
          });

        await service.handle(
          eventType,
          {
            emailId:
              'resend-email-status',

            tags: {
              opsdesk_delivery_id:
                DELIVERY_ID,
            },
          },
          {
            webhookMessageId:
              'webhook-message-status',
          },
        );

        expect(
          txDeliveryUpdateManyMock,
        ).toHaveBeenLastCalledWith({
          where: {
            id:
              DELIVERY_ID,

            status: {
              in: [
                'PENDING',
                'SENDING',
                'SENT',
                'DELAYED',
              ],
            },
          },

          data: {
            status:
              expectedStatus,

            failedAt:
              expect.any(Date),
          },
        });
        expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledTimes(1);
        expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledWith({
          organizationId: delivery.organizationId,
          ticketId: delivery.ticketId,
          messageId: delivery.messageId,
          emailDeliveryId: DELIVERY_ID,
          status: expectedStatus,
        });
      },
    );

    it(
      'does not allow a late sent event to regress a delivered status',
      async () => {
        txDeliveryUpdateManyMock
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 });
        deliveryFindUniqueMock
          .mockResolvedValue({
            ...delivery,
            status: 'DELIVERED',
            id:
              DELIVERY_ID,
          });

        const result = await service.handle(
          'email.sent',
          {
            emailId:
              'resend-email-late',

            tags: {
              opsdesk_delivery_id:
                DELIVERY_ID,
            },
          },
          {
            webhookMessageId:
              'webhook-message-late',
          },
        );

        expect(
          txDeliveryUpdateManyMock,
        ).toHaveBeenLastCalledWith(
          expect.objectContaining({
            where: {
              id:
                DELIVERY_ID,

              status: {
                in: [
                  'PENDING',
                  'SENDING',
                ],
              },
            },
          }),
        );
        expect(result).toEqual({ status: 'processed' });
        expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      },
    );

    it.each([
      { eventType: 'email.sent', status: 'SENT' },
      { eventType: 'email.delivery_delayed', status: 'DELAYED' },
    ] as const)(
      'does not publish another $status event when $eventType matches the current status',
      async ({ eventType, status }) => {
        deliveryFindUniqueMock.mockResolvedValue({ ...delivery, status });
        txDeliveryUpdateManyMock.mockImplementation(async (input) => {
          if (!input.where.status) {
            return { count: 1 };
          }
          // Model the database match so allowing the current status
          // would cause this regression test to publish an extra event.
          return { count: input.where.status.in.includes(status) ? 1 : 0 };
        });

        await expect(service.handle(eventType, {
          emailId: 'resend-email-same-state',
          tags: { opsdesk_delivery_id: DELIVERY_ID },
        }, {
          webhookMessageId: 'webhook-message-same-state',
        })).resolves.toEqual({ status: 'processed' });

        expect(txDeliveryUpdateManyMock).toHaveBeenCalledTimes(2);
        expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      },
    );

    it(
      'treats a replayed webhook as a duplicate',
      async () => {
        deliveryFindUniqueMock
          .mockResolvedValue({
            ...delivery,
            id:
              DELIVERY_ID,
          });

        transactionMock
          .mockRejectedValueOnce({
            code:
              'P2002',
          });

        await expect(
          service.handle(
            'email.bounced',
            {
              emailId:
                'resend-email-3',

              tags: [
                {
                  name:
                    'opsdesk_delivery_id',

                  value:
                    DELIVERY_ID,
                },
              ],
            },
            {
              webhookMessageId:
                'webhook-message-3',
            },
          ),
        ).resolves.toEqual({
          status:
            'duplicate',
        });
        expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      },
    );

    it('does not publish a delivery update if the transaction fails to commit', async () => {
      const error = new Error('Commit failed');
      transactionMock.mockImplementationOnce(async (callback) => {
        await callback(transactionClient);
        throw error;
      });

      await expect(service.handle('email.delivered', {
        emailId: 'resend-email-commit',
        tags: { opsdesk_delivery_id: DELIVERY_ID },
      }, {
        webhookMessageId: 'webhook-message-commit',
      })).rejects.toBe(error);

      expect(txDeliveryUpdateManyMock).toHaveBeenCalledTimes(2);
      expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
    });
  },
);
