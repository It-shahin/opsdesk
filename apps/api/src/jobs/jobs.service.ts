import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  Queue,
} from 'bullmq';

import {
  randomUUID,
} from 'node:crypto';

import {
  EMAIL_JOB_NAMES,
  QUEUE_NAMES,
} from './jobs.constants.js';

import {
  createQueueRedisConnection,
} from './bullmq-connection.js';

import type {
  EmailSmokeTestJob,
  SendTicketReplyJob,
} from './jobs.types.js';

@Injectable()
export class JobsService
  implements OnModuleDestroy
{
  private readonly logger =
    new Logger(
      JobsService.name,
    );

  private readonly connection;

  private readonly emailQueue:
    Queue;

  constructor(
    config:
      ConfigService,
  ) {
    const redisUrl =
      config.getOrThrow<string>(
        'REDIS_URL',
      );

    this.connection =
      createQueueRedisConnection(
        redisUrl,
      );

    this.emailQueue =
      new Queue(
        QUEUE_NAMES.EMAIL,
        {
          connection:
            this.connection,

          defaultJobOptions: {
            attempts:
              5,

            backoff: {
              type:
                'exponential',

              delay:
                3_000,
            },

            removeOnComplete: {
              age:
                60 * 60,

              count:
                1_000,
            },

            removeOnFail: {
              age:
                7 *
                24 *
                60 *
                60,

              count:
                5_000,
            },
          },
        },
      );
  }

  async enqueueSmokeTest() {
    const payload:
      EmailSmokeTestJob = {
      requestedAt:
        new Date()
          .toISOString(),
    };

    return this.emailQueue.add(
      EMAIL_JOB_NAMES
        .SMOKE_TEST,

      payload,

      {
        jobId:
          `smoke-${randomUUID()}`,
      },
    );
  }

  async enqueueTicketReply(
    input:
      SendTicketReplyJob,
  ) {
    return this.emailQueue.add(
      EMAIL_JOB_NAMES
        .SEND_TICKET_REPLY,

      input,

      {
        /*
         * We'll improve this
         * idempotency strategy
         * during 7C/7F.
         */
        jobId:
          `ticket-reply-${input.messageId}`,
      },
    );
  }

  async onModuleDestroy() {
    await this.emailQueue.close();

    await this.connection.quit();

    this.logger.log(
      'BullMQ connections closed',
    );
  }
}