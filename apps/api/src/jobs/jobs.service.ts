import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Queue } from 'bullmq';

import { randomUUID } from 'node:crypto';

import { createQueueRedisConnection } from './bullmq-connection.js';

import {
  EMAIL_JOB_NAMES,
  MAINTENANCE_JOB_NAMES,
  QUEUE_NAMES,
} from './jobs.constants.js';

import type {
  CleanupAttachmentsJob,
  EmailSmokeTestJob,
  RecoverEmailDeliveriesJob,
  SendTicketReplyJob,
} from './jobs.types.js';

@Injectable()
export class JobsService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  private readonly connection;

  private readonly emailQueue: Queue;

  private readonly maintenanceConnection;

  private readonly maintenanceQueue:
    Queue;

  constructor(config: ConfigService) {
    const redisUrl = config.getOrThrow<string>('REDIS_URL');

    this.connection = createQueueRedisConnection(redisUrl);

    this.emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
      connection: this.connection,

      defaultJobOptions: {
        attempts: 5,

        backoff: {
          type: 'exponential',

          delay: 3_000,
        },

        removeOnComplete: {
          age: 60 * 60,

          count: 1_000,
        },

        removeOnFail: {
          age: 7 * 24 * 60 * 60,

          count: 5_000,
        },
      },
    });

    this.maintenanceConnection =
      createQueueRedisConnection(
        redisUrl,
      );

    this.maintenanceQueue =
      new Queue(
        QUEUE_NAMES.MAINTENANCE,
        {
          connection:
            this.maintenanceConnection,

          defaultJobOptions: {
            attempts:
              3,

            backoff: {
              type:
                'exponential',

              delay:
                5_000,
            },

            removeOnComplete: {
              age:
                24 * 60 * 60,

              count:
                200,
            },

            removeOnFail: {
              age:
                7 * 24 * 60 * 60,

              count:
                500,
            },
          },
        },
      );
  }

  async onModuleInit() {
    await Promise.all([
      this.emailQueue
        .upsertJobScheduler(
          'recover-pending-email-deliveries',

          {
            every:
              60_000,
          },

          {
            name:
              EMAIL_JOB_NAMES
                .RECOVER_PENDING,

            data: {
              requestedAt:
                new Date()
                  .toISOString(),
            } satisfies RecoverEmailDeliveriesJob,
          },
        ),

      this.maintenanceQueue
        .upsertJobScheduler(
          'cleanup-abandoned-attachments',

          {
            every:
              15 *
              60 *
              1000,
          },

          {
            name:
              MAINTENANCE_JOB_NAMES
                .CLEANUP_ATTACHMENTS,

            data: {
              scheduled:
                true,
            } satisfies CleanupAttachmentsJob,
          },
        ),
    ]);

    this.logger.log(
      'Recurring job schedulers registered',
    );
  }

  async enqueueSmokeTest() {
    const payload: EmailSmokeTestJob = {
      requestedAt: new Date().toISOString(),
    };

    return this.emailQueue.add(
      EMAIL_JOB_NAMES.SMOKE_TEST,

      payload,

      {
        jobId: `smoke-${randomUUID()}`,
      },
    );
  }

  async ensureEmailDeliveryQueued(emailDeliveryId: string) {
    const jobId = `email-delivery-${emailDeliveryId}`;

    const existing = await this.emailQueue.getJob(jobId);

    if (existing) {
      const state = await existing.getState();

      if (state === 'failed') {
        await existing.retry();

        return existing;
      }

      if (state === 'completed') {
        /*
         * PostgreSQL says the delivery still
         * needs work but BullMQ thinks an old
         * execution completed.
         */
        await existing.remove();
      } else {
        /*
         * waiting / active / delayed etc.
         */
        return existing;
      }
    }

    return this.emailQueue.add(
      EMAIL_JOB_NAMES.SEND_TICKET_REPLY,

      {
        emailDeliveryId,
      } satisfies SendTicketReplyJob,

      {
        jobId,

        attempts: 5,

        backoff: {
          type: 'exponential',

          delay: 3_000,
        },
      },
    );
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.emailQueue
        .close(),

      this.maintenanceQueue
        .close(),
    ]);

    await Promise.allSettled([
      this.connection
        .quit(),

      this.maintenanceConnection
        .quit(),
    ]);

    this.logger.log(
      'BullMQ connections closed',
    );
  }
}
