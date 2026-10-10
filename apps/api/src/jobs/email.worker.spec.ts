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

import {
  JobsService,
} from './jobs.service.js';

import type {
  SendTicketReplyJob,
} from './jobs.types.js';

import type {
  RealtimeService,
} from '../realtime/realtime.service.js';

const DELIVERY_ID =
  '819f42f7-5181-4eb7-9f33-256c89ff6f4c';

const TICKET_ID =
  '219f42f7-5181-4eb7-9f33-256c89ff6f4c';

const ORG_ID =
  '11111111-1111-4111-8111-111111111111';

const MESSAGE_ID =
  '33333333-3333-4333-8333-333333333333';

const deliveryContext = {
  organizationId: ORG_ID,
  ticketId: TICKET_ID,
  messageId: MESSAGE_ID,
  emailDeliveryId: DELIVERY_ID,
};

describe(
  'EmailWorker delivery processing',
  () => {
    const deliveryFindUniqueMock =
      jest.fn();

    const deliveryUpdateManyMock =
      jest.fn();

    const deliveryFindManyMock =
      jest.fn();

    const sendTicketReplyMock =
      jest.fn();

    const ensureEmailDeliveryQueuedMock =
      jest.fn();

    const publishEmailDeliveryUpdatedMock =
      jest.fn<RealtimeService['publishEmailDeliveryUpdated']>();

    const realtime = {
      publishEmailDeliveryUpdated:
        publishEmailDeliveryUpdatedMock,
    };

    const logger = {
      log: jest.fn<(message: string) => void>(),
      error: jest.fn<(message: string) => void>(),
    };

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

              findMany:
                deliveryFindManyMock,
            },
          } as unknown as PrismaService,

          emailService: {
            sendTicketReply:
              sendTicketReplyMock,
          } as unknown as EmailService,

          jobsService: {
            ensureEmailDeliveryQueued:
              ensureEmailDeliveryQueuedMock,
          } as unknown as JobsService,

          realtime:
            realtime as unknown as RealtimeService,

          logger,
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

    const processRecovery =
      (
        worker as unknown as {
          processRecovery:
            () => Promise<unknown>;
        }
      ).processRecovery.bind(
        worker,
      );

    const delivery = {
      id:
        DELIVERY_ID,

      organizationId: ORG_ID,
      ticketId: TICKET_ID,
      messageId: MESSAGE_ID,

      status:
        'PENDING',

      recipientEmail:
        'customer@example.com',

      message: {
        id:
          MESSAGE_ID,

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

      publishEmailDeliveryUpdatedMock.mockReturnValue(false);

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

      deliveryFindManyMock
        .mockResolvedValue([]);

      ensureEmailDeliveryQueuedMock
        .mockResolvedValue(
          undefined,
        );
    });

    it('logs safe provider diagnostics before a permanent rejection is wrapped by BullMQ', async () => {
      sendTicketReplyMock.mockRejectedValue(new EmailProviderError(
        'private@example.test SECRET', false,
        { providerCode: 'validation_error', providerStatus: 403 },
      ));
      await expect(processTicketReply(createJob())).rejects.toBeInstanceOf(UnrecoverableError);
      expect(logger.error).toHaveBeenCalledWith(JSON.stringify({
        event: 'email.provider.failed', providerCode: 'validation_error',
        providerStatus: 403, retryable: false, finalAttempt: true,
      }));
      expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/SECRET|private@/);
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

        expect(deliveryFindUniqueMock).toHaveBeenCalledWith({
          where: { id: DELIVERY_ID },
          select: expect.objectContaining({
            id: true,
            organizationId: true,
            ticketId: true,
            messageId: true,
            message: expect.any(Object),
          }),
        });
        expect(publishEmailDeliveryUpdatedMock.mock.calls).toEqual([
          [{ ...deliveryContext, status: 'SENDING' }],
          [{ ...deliveryContext, status: 'SENT' }],
        ]);
        const updates = deliveryUpdateManyMock.mock.invocationCallOrder;
        const events = publishEmailDeliveryUpdatedMock.mock.invocationCallOrder;
        const send = sendTicketReplyMock.mock.invocationCallOrder[0]!;
        expect(updates[0]!).toBeLessThan(events[0]!);
        expect(events[0]!).toBeLessThan(send);
        expect(send).toBeLessThan(updates[1]!);
        expect(updates[1]!).toBeLessThan(updates[2]!);
        expect(updates[2]!).toBeLessThan(events[1]!);
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
        expect(publishEmailDeliveryUpdatedMock.mock.calls).toEqual([
          [{ ...deliveryContext, status: 'SENDING' }],
          [{ ...deliveryContext, status: 'PENDING' }],
        ]);
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
        expect(publishEmailDeliveryUpdatedMock.mock.calls).toEqual([
          [{ ...deliveryContext, status: 'SENDING' }],
          [{ ...deliveryContext, status: 'FAILED' }],
        ]);
      },
    );

    it(
      'marks the final transient failure as failed',
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
            createJob(4),
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
              'FAILED',

            failedAt:
              expect.any(Date),

            lastError:
              'EmailProviderError',
          },
        });
        expect(publishEmailDeliveryUpdatedMock.mock.calls).toEqual([
          [{ ...deliveryContext, status: 'SENDING' }],
          [{ ...deliveryContext, status: 'FAILED' }],
        ]);
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
        expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      },
    );

    it.each([
      'SENT',
      'DELIVERED',
      'BOUNCED',
      'COMPLAINED',
      'SUPPRESSED',
      'FAILED',
    ])(
      'skips a stale job when the delivery is already %s',
      async (
        status,
      ) => {
        deliveryFindUniqueMock
          .mockResolvedValue({
            ...delivery,
            status,
          });

        await expect(
          processTicketReply(
            createJob(),
          ),
        ).resolves.toEqual({
          skipped:
            true,

          status,
        });

        expect(
          deliveryUpdateManyMock,
        ).not.toHaveBeenCalled();

        expect(
          sendTicketReplyMock,
        ).not.toHaveBeenCalled();
        expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      },
    );

    it.each([
      { sentCount: 0, reconciliationCount: 1 },
      { sentCount: 1, reconciliationCount: 0 },
    ])(
      'publishes SENT based on the status update count $sentCount, not reconciliation count $reconciliationCount',
      async ({ sentCount, reconciliationCount }) => {
        deliveryUpdateManyMock
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: sentCount })
          .mockResolvedValueOnce({ count: reconciliationCount });

        await expect(processTicketReply(createJob())).resolves.toEqual({
          providerMessageId: 'resend-email-1',
        });

        expect(deliveryUpdateManyMock).toHaveBeenNthCalledWith(3, {
          where: { id: DELIVERY_ID, providerMessageId: null },
          data: { providerMessageId: 'resend-email-1' },
        });
        expect(publishEmailDeliveryUpdatedMock.mock.calls).toEqual([
          [{ ...deliveryContext, status: 'SENDING' }],
          ...(sentCount === 1
            ? [[{ ...deliveryContext, status: 'SENT' }]]
            : []),
        ]);
      },
    );

    it.each([
      { description: 'transient retry', retryable: true, attemptsMade: 0, status: 'PENDING' },
      { description: 'permanent failure', retryable: false, attemptsMade: 0, status: 'FAILED' },
      { description: 'final attempt', retryable: true, attemptsMade: 4, status: 'FAILED' },
    ])(
      'does not publish a stale status when the $description update is rejected',
      async ({ retryable, attemptsMade, status }) => {
        const error = new EmailProviderError('Provider failure', retryable);
        sendTicketReplyMock.mockRejectedValue(error);
        deliveryUpdateManyMock
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 });

        const pending = processTicketReply(createJob(attemptsMade));
        if (retryable) {
          await expect(pending).rejects.toBe(error);
        } else {
          await expect(pending).rejects.toBeInstanceOf(UnrecoverableError);
        }
        expect(deliveryUpdateManyMock).toHaveBeenCalledTimes(2);
        expect(deliveryUpdateManyMock).toHaveBeenLastCalledWith(expect.objectContaining({
          where: { id: DELIVERY_ID, status: 'SENDING' },
          data: expect.objectContaining({ status }),
        }));
        expect(publishEmailDeliveryUpdatedMock.mock.calls).toEqual([
          [{ ...deliveryContext, status: 'SENDING' }],
        ]);
      },
    );

    it.each([
      {
        description: 'missing recipient',
        recipientEmail: null,
        message: delivery.message,
        lastError: 'Recipient email is missing',
        errorMessage: 'Recipient email is missing',
      },
      {
        description: 'internal note',
        recipientEmail: delivery.recipientEmail,
        message: { ...delivery.message, kind: 'INTERNAL_NOTE' },
        lastError: 'Invalid email message state',
        errorMessage: 'Email delivery references an invalid message',
      },
      {
        description: 'customer-authored message',
        recipientEmail: delivery.recipientEmail,
        message: { ...delivery.message, authorType: 'CUSTOMER' },
        lastError: 'Invalid email message state',
        errorMessage: 'Email delivery references an invalid message',
      },
    ].flatMap((scenario) => [0, 1].map((count) => ({ ...scenario, count }))))(
      'fails a $description and publishes FAILED only for update count 1 (count=$count)',
      async ({ recipientEmail, message, lastError, errorMessage, count }) => {
        deliveryFindUniqueMock.mockResolvedValue({ ...delivery, recipientEmail, message });
        deliveryUpdateManyMock
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count });

        const pending = processTicketReply(createJob());
        await expect(pending).rejects.toBeInstanceOf(UnrecoverableError);
        await expect(pending).rejects.toThrow(errorMessage);

        expect(deliveryUpdateManyMock).toHaveBeenCalledTimes(2);
        expect(deliveryUpdateManyMock).toHaveBeenLastCalledWith({
          where: { id: DELIVERY_ID, status: 'SENDING' },
          data: { status: 'FAILED', failedAt: expect.any(Date), lastError },
        });
        expect(publishEmailDeliveryUpdatedMock.mock.calls).toEqual([
          [{ ...deliveryContext, status: 'SENDING' }],
          ...(count === 1
            ? [[{ ...deliveryContext, status: 'FAILED' }]]
            : []),
        ]);
        expect(sendTicketReplyMock).not.toHaveBeenCalled();
      },
    );

    it('does not publish when claiming the delivery fails', async () => {
      const error = new Error('Database unavailable');
      deliveryUpdateManyMock.mockRejectedValueOnce(error);

      await expect(processTicketReply(createJob())).rejects.toBe(error);
      expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      expect(sendTicketReplyMock).not.toHaveBeenCalled();
    });

    it(
      'recovers stale sending deliveries and reconstructs pending jobs',
      async () => {
        const deliveryB =
          '99999999-9999-4999-8999-999999999999';

        const staleDeliveries = [
          delivery,
          {
            ...delivery,
            id: deliveryB,
            organizationId: '22222222-2222-4222-8222-222222222222',
            ticketId: '44444444-4444-4444-8444-444444444444',
            messageId: '55555555-5555-4555-8555-555555555555',
          },
        ];

        deliveryFindManyMock
          .mockResolvedValueOnce(staleDeliveries)
          .mockResolvedValueOnce([
            {
              id:
                DELIVERY_ID,
            },
            {
              id:
                deliveryB,
            },
          ]);

        await expect(
          processRecovery(),
        ).resolves.toEqual({
          staleReset: 2,
          pendingFound: 2,
          queued: 2,
          queueFailures: 0,
        });

        expect(
          deliveryFindManyMock,
        ).toHaveBeenNthCalledWith(1, {
          where: {
            status:
              'SENDING',

            lastAttemptAt: {
              lt:
                expect.any(Date),
            },
          },
          select: {
            id: true,
            organizationId: true,
            ticketId: true,
            messageId: true,
          },
          take: 100,
        });

        const staleBefore = deliveryFindManyMock.mock.calls[0]![0].where.lastAttemptAt.lt;
        expect(deliveryUpdateManyMock).toHaveBeenCalledTimes(2);
        for (const [index, staleDelivery] of staleDeliveries.entries()) {
          expect(deliveryUpdateManyMock).toHaveBeenNthCalledWith(index + 1, {
            where: {
              id: staleDelivery.id,
              status: 'SENDING',
              lastAttemptAt: { lt: staleBefore },
            },
            data: {
              status: 'PENDING',
              lastError: 'Recovered stale sending attempt',
            },
          });
          expect(publishEmailDeliveryUpdatedMock).toHaveBeenNthCalledWith(index + 1, {
            organizationId: staleDelivery.organizationId,
            ticketId: staleDelivery.ticketId,
            messageId: staleDelivery.messageId,
            emailDeliveryId: staleDelivery.id,
            status: 'PENDING',
          });
          expect(deliveryUpdateManyMock.mock.invocationCallOrder[index]!)
            .toBeLessThan(publishEmailDeliveryUpdatedMock.mock.invocationCallOrder[index]!);
        }
        expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledTimes(2);
        expect(deliveryFindManyMock).toHaveBeenNthCalledWith(2, {
          where: { status: 'PENDING' },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
          take: 100,
        });
        expect(publishEmailDeliveryUpdatedMock.mock.invocationCallOrder[1]!)
          .toBeLessThan(deliveryFindManyMock.mock.invocationCallOrder[1]!);

        expect(
          ensureEmailDeliveryQueuedMock,
        ).toHaveBeenCalledWith(
          DELIVERY_ID,
        );

        expect(
          ensureEmailDeliveryQueuedMock,
        ).toHaveBeenCalledWith(
          deliveryB,
        );
      },
    );

    it('does not publish recovery when the stale delivery no longer matches', async () => {
      deliveryFindManyMock
        .mockResolvedValueOnce([delivery])
        .mockResolvedValueOnce([]);
      deliveryUpdateManyMock.mockResolvedValueOnce({ count: 0 });

      await expect(processRecovery()).resolves.toEqual({ staleReset: 0, pendingFound: 0, queued: 0, queueFailures: 0 });

      expect(deliveryUpdateManyMock).toHaveBeenCalledTimes(1);
      expect(deliveryUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: DELIVERY_ID,
          status: 'SENDING',
          lastAttemptAt: { lt: expect.any(Date) },
        },
      }));
      expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      expect(ensureEmailDeliveryQueuedMock).not.toHaveBeenCalled();
    });

    it('discovers existing pending jobs even when there are no stale deliveries', async () => {
      deliveryFindManyMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: DELIVERY_ID }]);

      await expect(processRecovery()).resolves.toEqual({ staleReset: 0, pendingFound: 1, queued: 1, queueFailures: 0 });

      expect(deliveryUpdateManyMock).not.toHaveBeenCalled();
      expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      expect(ensureEmailDeliveryQueuedMock).toHaveBeenCalledWith(DELIVERY_ID);
    });

    it('does not publish recovery when resetting the delivery fails', async () => {
      deliveryFindManyMock.mockResolvedValueOnce([delivery]);
      const error = new Error('Database unavailable');
      deliveryUpdateManyMock.mockRejectedValueOnce(error);

      await expect(processRecovery()).rejects.toBe(error);

      expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      expect(deliveryFindManyMock).toHaveBeenCalledTimes(1);
      expect(ensureEmailDeliveryQueuedMock).not.toHaveBeenCalled();
    });

    it('reports queue failures independently and continues queueing remaining pending deliveries', async () => {
      const ids = [DELIVERY_ID, 'pending-2', 'pending-3'];
      deliveryFindManyMock
        .mockResolvedValueOnce([delivery])
        .mockResolvedValueOnce(ids.map(id => ({ id })));
      ensureEmailDeliveryQueuedMock
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('secret recipient@example.test and message body'))
        .mockResolvedValueOnce(undefined);

      const result = { staleReset: 1, pendingFound: 3, queued: 2, queueFailures: 1 };
      await expect(processRecovery()).resolves.toEqual(result);
      expect(ensureEmailDeliveryQueuedMock.mock.calls).toEqual(ids.map(id => [id]));
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(JSON.parse(logger.error.mock.calls[0]![0])).toEqual({
        event: 'email.recovery.queue_failed', deliveryId: 'pending-2',
      });
      expect(JSON.parse(logger.log.mock.calls[0]![0])).toEqual({
        event: 'email.recovery.completed', ...result,
      });
    });

    it('reports zero work for an empty recovery run', async () => {
      deliveryFindManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const result = { staleReset: 0, pendingFound: 0, queued: 0, queueFailures: 0 };
      await expect(processRecovery()).resolves.toEqual(result);
      expect(JSON.parse(logger.log.mock.calls[0]![0])).toEqual({
        event: 'email.recovery.completed', ...result,
      });
      expect(logger.error).not.toHaveBeenCalled();
    });
  },
);
