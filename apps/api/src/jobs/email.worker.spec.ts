import {
  UnrecoverableError,
} from 'bullmq';

import type {
  Job,
} from 'bullmq';

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
  EmailProviderError,
  EmailService,
} from '../email/email.service.js';

import {
  EmailWorker,
} from './email.worker.js';

import type {
  SendTicketReplyJob,
} from './jobs.types.js';

const DELIVERY_ID =
  '819f42f7-5181-4eb7-9f33-256c89ff6f4c';

const TICKET_ID =
  '219f42f7-5181-4eb7-9f33-256c89ff6f4c';

describe(
  'EmailWorker delivery processing',
  () => {
    const deliveryFindUniqueMock =
      jest.fn();

    const deliveryUpdateManyMock =
      jest.fn();

    const sendTicketReplyMock =
      jest.fn();

    const worker =
      Object.assign(
        Object.create(
          EmailWorker.prototype,
        ) as EmailWorker,
        {
          prisma: {
            emailDelivery: {
              findUnique:
                deliveryFindUniqueMock,

              updateMany:
                deliveryUpdateManyMock,
            },
          } as unknown as PrismaService,

          emailService: {
            sendTicketReply:
              sendTicketReplyMock,
          } as unknown as EmailService,

          logger: {
            log:
              jest.fn(),
          },
        },
      );

    const processTicketReply =
      (
        worker as unknown as {
          processTicketReply:
            (
              job:
                Job<SendTicketReplyJob>,
            ) => Promise<unknown>;
        }
      ).processTicketReply.bind(
        worker,
      );

    const delivery = {
      id:
        DELIVERY_ID,

      status:
        'PENDING',

      recipientEmail:
        'customer@example.com',

      message: {
        id:
          'message-1',

        kind:
          'PUBLIC_REPLY',

        authorType:
          'MEMBER',

        body:
          'Hello customer.',

        ticket: {
          id:
            TICKET_ID,

          subject:
            'Test ticket',

          customer: {
            name:
              'Jane Customer',
          },
        },
      },
    };

    const createJob = (
      attemptsMade =
        0,
    ) =>
      ({
        data: {
          emailDeliveryId:
            DELIVERY_ID,
        },

        opts: {
          attempts:
            5,
        },

        attemptsMade,
      }) as Job<SendTicketReplyJob>;

    beforeEach(() => {
      jest.resetAllMocks();

      deliveryFindUniqueMock
        .mockResolvedValue(
          delivery,
        );

      deliveryUpdateManyMock
        .mockResolvedValue({
          count:
            1,
        });

      sendTicketReplyMock
        .mockResolvedValue({
          providerMessageId:
            'resend-email-1',
        });
    });

    it(
      'claims a pending delivery and marks it sent',
      async () => {
        await expect(
          processTicketReply(
            createJob(),
          ),
        ).resolves.toEqual({
          providerMessageId:
            'resend-email-1',
        });

        expect(
          deliveryUpdateManyMock,
        ).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            where: {
              id:
                DELIVERY_ID,

              status:
                'PENDING',
            },

            data:
              expect.objectContaining({
                status:
                  'SENDING',
              }),
          }),
        );

        expect(
          sendTicketReplyMock,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            deliveryId:
              DELIVERY_ID,

            ticketId:
              TICKET_ID,

            to:
              'customer@example.com',
          }),
        );

        expect(
          deliveryUpdateManyMock,
        ).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            where: {
              id:
                DELIVERY_ID,

              status:
                'SENDING',
            },

            data:
              expect.objectContaining({
                status:
                  'SENT',

                providerMessageId:
                  'resend-email-1',
              }),
          }),
        );
      },
    );

    it(
      'returns a transient provider failure to pending for BullMQ retry',
      async () => {
        sendTicketReplyMock
          .mockRejectedValue(
            new EmailProviderError(
              'Temporary failure',
              true,
            ),
          );

        await expect(
          processTicketReply(
            createJob(),
          ),
        ).rejects.toBeInstanceOf(
          EmailProviderError,
        );

        expect(
          deliveryUpdateManyMock,
        ).toHaveBeenLastCalledWith({
          where: {
            id:
              DELIVERY_ID,

            status:
              'SENDING',
          },

          data: {
            status:
              'PENDING',

            lastError:
              'EmailProviderError',
          },
        });
      },
    );

    it(
      'marks a permanent provider failure as failed without retrying',
      async () => {
        sendTicketReplyMock
          .mockRejectedValue(
            new EmailProviderError(
              'Permanent failure',
              false,
            ),
          );

        await expect(
          processTicketReply(
            createJob(),
          ),
        ).rejects.toBeInstanceOf(
          UnrecoverableError,
        );

        expect(
          deliveryUpdateManyMock,
        ).toHaveBeenLastCalledWith({
          where: {
            id:
              DELIVERY_ID,

            status:
              'SENDING',
          },

          data: {
            status:
              'FAILED',

            failedAt:
              expect.any(Date),

            lastError:
              'EmailProviderError',
          },
        });
      },
    );

    it(
      'allows only one duplicate job to claim the pending delivery',
      async () => {
        deliveryUpdateManyMock
          .mockResolvedValueOnce({
            count:
              0,
          });

        await expect(
          processTicketReply(
            createJob(),
          ),
        ).resolves.toEqual({
          skipped:
            true,
        });

        expect(
          sendTicketReplyMock,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
