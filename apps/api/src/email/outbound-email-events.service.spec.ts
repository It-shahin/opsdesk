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

const DELIVERY_ID =
  '819f42f7-5181-4eb7-9f33-256c89ff6f4c';

describe(
  'OutboundEmailEventsService',
  () => {
    const deliveryFindUniqueMock =
      jest.fn();

    const txWebhookEventCreateMock =
      jest.fn();

    const txDeliveryUpdateManyMock =
      jest.fn();

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
            ) => Promise<void>,
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
        );
    });

    it(
      'correlates a delivered event by tag and prevents terminal regression',
      async () => {
        deliveryFindUniqueMock
          .mockResolvedValue({
            id:
              DELIVERY_ID,
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
    ] as const)(
      'maps %s to %s without allowing terminal-state regression',
      async (
        eventType,
        expectedStatus,
      ) => {
        deliveryFindUniqueMock
          .mockResolvedValue({
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
      },
    );

    it(
      'does not allow a late sent event to regress a delivered status',
      async () => {
        deliveryFindUniqueMock
          .mockResolvedValue({
            id:
              DELIVERY_ID,
          });

        await service.handle(
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
                  'SENT',
                ],
              },
            },
          }),
        );
      },
    );

    it(
      'treats a replayed webhook as a duplicate',
      async () => {
        deliveryFindUniqueMock
          .mockResolvedValue({
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
      },
    );
  },
);
