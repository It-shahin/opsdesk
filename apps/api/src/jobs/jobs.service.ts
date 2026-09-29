import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Queue } from 'bullmq';

import { randomUUID } from 'node:crypto';

import { EMAIL_JOB_NAMES, QUEUE_NAMES } from './jobs.constants.js';

import { createQueueRedisConnection } from './bullmq-connection.js';

import type {
  EmailSmokeTestJob,
  RecoverEmailDeliveriesJob,
  SendTicketReplyJob,
} from './jobs.types.js';

@Injectable()
export class JobsService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  private readonly connection;

  private readonly emailQueue: Queue;

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
  }

  async onModuleInit() {
    await this.emailQueue.upsertJobScheduler(
      'recover-pending-email-deliveries',

      {
        every: 60_000,
      },

      {
        name: EMAIL_JOB_NAMES.RECOVER_PENDING,

        data: {
          requestedAt: new Date().toISOString(),
        } satisfies RecoverEmailDeliveriesJob,
      },
    );

    this.logger.log('Email recovery scheduler registered');
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
    await this.emailQueue.close();

    await this.connection.quit();

    this.logger.log('BullMQ connections closed');
  }
}
