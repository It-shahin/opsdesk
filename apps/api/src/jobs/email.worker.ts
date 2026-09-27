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
    _job:
      Job<SendTicketReplyJob>,
  ) {
    /*
     * Implemented in 7B/7C.
     */
    throw new Error(
      'Ticket email delivery is not implemented yet',
    );
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