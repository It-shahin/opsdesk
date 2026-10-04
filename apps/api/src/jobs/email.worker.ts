import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  Job,
  UnrecoverableError,
  Worker,
} from 'bullmq';

import {
  EMAIL_JOB_NAMES,
  QUEUE_NAMES,
} from './jobs.constants.js';

import {
  createWorkerRedisConnection,
} from './bullmq-connection.js';

import type {
  EmailSmokeTestJob,
  SendTicketReplyJob,
} from './jobs.types.js';

import {
  JobsService,
} from './jobs.service.js';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  EmailProviderError,
  EmailService,
} from '../email/email.service.js';

import {
  buildTicketReplyEmail,
} from '../email/ticket-reply-email.js';

import {
  RealtimeService,
} from '../realtime/realtime.service.js';

import type {
  EmailDeliveryStatus,
} from '../generated/prisma/enums.js';

@Injectable()
export class EmailWorker
  implements
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger =
    new Logger(
      EmailWorker.name,
    );

  private readonly connection;

  private worker:
    Worker | null =
      null;

  constructor(
  config:
    ConfigService,

  private readonly prisma:
    PrismaService,

  private readonly emailService:
    EmailService,

  private readonly jobsService:
    JobsService,

  private readonly realtime:
    RealtimeService,

) {
  this.connection =
    createWorkerRedisConnection(
      config.getOrThrow<string>(
        'REDIS_URL',
      ),
    );
}

  onModuleInit() {
    this.worker =
      new Worker(
        QUEUE_NAMES.EMAIL,

        async (
          job:
            Job,
        ) =>
          this.processJob(
            job,
          ),

        {
          connection:
            this.connection,

          concurrency:
            5,
        },
      );

    this.worker.on(
      'completed',
      (job) => {
        this.logger.log(
          `Completed job ${job.id} (${job.name})`,
        );
      },
    );

    this.worker.on(
      'failed',
      (
        job,
        error,
      ) => {
        this.logger.error(
          `Job ${job?.id ?? 'unknown'} failed: ${error.message}`,
        );
      },
    );

    this.logger.log(
      'Email worker started',
    );
  }

  private async processJob(
    job:
      Job,
  ) {
    switch (
      job.name
    ) {
      case EMAIL_JOB_NAMES
        .SMOKE_TEST:
        return this.processSmokeTest(
          job as Job<EmailSmokeTestJob>,
        );

      case EMAIL_JOB_NAMES
        .SEND_TICKET_REPLY:
        return this.processTicketReply(
          job as Job<SendTicketReplyJob>,
        );

      case EMAIL_JOB_NAMES
        .RECOVER_PENDING:
        return this
          .processRecovery();

      default:
        throw new Error(
          `Unsupported job type: ${job.name}`,
        );
    }
  }

  private async processSmokeTest(
    job:
      Job<EmailSmokeTestJob>,
  ) {
    this.logger.log(
      `Smoke test processed: ${job.id}`,
    );

    return {
      processedAt:
        new Date()
          .toISOString(),
    };
  }

  private async processTicketReply(
    job:
      Job<SendTicketReplyJob>,
  ) {
    const delivery =
      await this.prisma
        .emailDelivery
        .findUnique({
          where: {
            id:
              job.data
                .emailDeliveryId,
          },

          select: {
            id: true,
            status: true,
            recipientEmail: true,
            organizationId: true,
            ticketId: true,
            messageId: true,

            message: {
              select: {
                id: true,
                kind: true,
                authorType: true,
                body: true,

                ticket: {
                  select: {
                    id: true,
                    subject: true,

                    customer: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

    if (!delivery) {
      throw new UnrecoverableError(
        'Email delivery not found',
      );
    }

    const terminalStatuses =
      new Set([
        'SENT',
        'DELIVERED',
        'BOUNCED',
        'COMPLAINED',
        'SUPPRESSED',
        'FAILED',
      ]);

    if (
      terminalStatuses.has(
        delivery.status,
      )
    ) {
      return {
        skipped:
          true,

        status:
          delivery.status,
      };
    }

    const claimed =
      await this.prisma
        .emailDelivery
        .updateMany({
          where: {
            id:
              delivery.id,

            status:
              'PENDING',
          },

          data: {
            status:
              'SENDING',

            attemptCount: {
              increment:
                1,
            },

            lastAttemptAt:
              new Date(),

            lastError:
              null,
          },
        });

    if (
      claimed.count !==
      1
    ) {
      return {
        skipped:
          true,
      };
    }

    this.publishDeliveryStatus(
      delivery,
      'SENDING',
    );

    if (
      !delivery.recipientEmail
    ) {
      const failed =
        await this.prisma
          .emailDelivery
          .updateMany({
            where: {
              id:
                delivery.id,

              status:
                'SENDING',
            },

            data: {
              status:
                'FAILED',

              failedAt:
                new Date(),

              lastError:
                'Recipient email is missing',
            },
          });

      if (failed.count === 1) {
        this.publishDeliveryStatus(
          delivery,
          'FAILED',
        );
      }

      throw new UnrecoverableError(
        'Recipient email is missing',
      );
    }

    if (
      delivery.message.kind !==
        'PUBLIC_REPLY' ||
      delivery.message.authorType !==
        'MEMBER'
    ) {
      const failed =
        await this.prisma
          .emailDelivery
          .updateMany({
            where: {
              id:
                delivery.id,

              status:
                'SENDING',
            },

            data: {
              status:
                'FAILED',

              failedAt:
                new Date(),

              lastError:
                'Invalid email message state',
            },
          });

      if (failed.count === 1) {
        this.publishDeliveryStatus(
          delivery,
          'FAILED',
        );
      }

      throw new UnrecoverableError(
        'Email delivery references an invalid message',
      );
    }

    const email =
      buildTicketReplyEmail({
        customerName:
          delivery.message
            .ticket
            .customer
            .name,

        ticketSubject:
          delivery.message
            .ticket
            .subject,

        body:
          delivery.message
            .body,
      });

    try {
      const result =
        await this.emailService
          .sendTicketReply({
            deliveryId:
              delivery.id,

            ticketId:
              delivery.message
                .ticket
                .id,

            to:
              delivery.recipientEmail,

            ...email,
          });

      const sent =
        await this.prisma
          .emailDelivery
          .updateMany({
            where: {
              id:
                delivery.id,

              status:
                'SENDING',
            },

            data: {
              status:
                'SENT',

              providerMessageId:
                result.providerMessageId,

              sentAt:
                new Date(),

              lastError:
                null,
            },
          });

      await this.prisma
        .emailDelivery
        .updateMany({
          where: {
            id:
              delivery.id,

            providerMessageId:
              null,
          },

          data: {
            providerMessageId:
              result.providerMessageId,
          },
        });

      if (sent.count === 1) {
        this.publishDeliveryStatus(
          delivery,
          'SENT',
        );
      }

      this.logger.log(
        `Sent email delivery ${delivery.id}; provider message ${result.providerMessageId}`,
      );

      return result;
    } catch (error) {
      const maxAttempts =
        job.opts.attempts ??
        1;

      const thisWasFinalAttempt =
        job.attemptsMade +
          1 >=
        maxAttempts;

      const retryable =
        error instanceof
          EmailProviderError
          ? error.retryable
          : true;

      const safeError =
        error instanceof Error
          ? error.name
          : 'UnknownEmailError';

      if (
        !retryable ||
        thisWasFinalAttempt
      ) {
        const failed =
          await this.prisma
            .emailDelivery
            .updateMany({
              where: {
                id:
                  delivery.id,

                status:
                  'SENDING',
              },

              data: {
                status:
                  'FAILED',

                failedAt:
                  new Date(),

                lastError:
                  safeError,
              },
            });

        if (failed.count === 1) {
          this.publishDeliveryStatus(
            delivery,
            'FAILED',
          );
        }

        if (!retryable) {
          throw new UnrecoverableError(
            'Permanent email delivery failure',
          );
        }

        throw error;
      }

      const reset =
        await this.prisma
          .emailDelivery
          .updateMany({
            where: {
              id:
                delivery.id,

              status:
                'SENDING',
            },

            data: {
              status:
                'PENDING',

              lastError:
                safeError,
            },
          });

      if (reset.count === 1) {
        this.publishDeliveryStatus(
          delivery,
          'PENDING',
        );
      }

      throw error;
    }
  }

  private publishDeliveryStatus(
    delivery: {
      id:
        string;

      organizationId:
        string;

      ticketId:
        string;

      messageId:
        string;
    },

    status:
      EmailDeliveryStatus,
  ) {
    this.realtime
      .publishEmailDeliveryUpdated({
        organizationId:
          delivery.organizationId,

        ticketId:
          delivery.ticketId,

        messageId:
          delivery.messageId,

        emailDeliveryId:
          delivery.id,

        status,
      });
  }

  private async processRecovery() {
    const staleBefore =
      new Date(
        Date.now() -
        10 * 60 * 1000,
      );

    const staleDeliveries =
      await this.prisma
        .emailDelivery
        .findMany({
          where: {
            status:
              'SENDING',

            lastAttemptAt: {
              lt:
                staleBefore,
            },
          },

          select: {
            id:
              true,

            organizationId:
              true,

            ticketId:
              true,

            messageId:
              true,
          },

          take:
            100,
        });

    for (
      const delivery
      of staleDeliveries
    ) {
      const reset =
        await this.prisma
          .emailDelivery
          .updateMany({
            where: {
              id:
                delivery.id,

              status:
                'SENDING',

              lastAttemptAt: {
                lt:
                  staleBefore,
              },
            },

            data: {
              status:
                'PENDING',

              lastError:
                'Recovered stale sending attempt',
            },
          });

      if (reset.count === 1) {
        this.publishDeliveryStatus(
          delivery,
          'PENDING',
        );
      }
    }

    const pending =
      await this.prisma
        .emailDelivery
        .findMany({
          where: {
            status:
              'PENDING',
          },

          select: {
            id:
              true,
          },

          orderBy: {
            createdAt:
              'asc',
          },

          take:
            100,
        });

    for (
      const delivery
      of pending
    ) {
      try {
        await this.jobsService
          .ensureEmailDeliveryQueued(
            delivery.id,
          );
      } catch {
        this.logger.error(
          `Failed to recover email delivery ${delivery.id}`,
        );
      }
    }

    return {
      recovered:
        pending.length,
    };
  }

  async onModuleDestroy() {
    if (
      this.worker
    ) {
      await this.worker.close();
    }

    await this.connection.quit();

    this.logger.log(
      'Email worker stopped',
    );
  }
}
