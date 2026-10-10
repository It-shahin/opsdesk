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
  AttachmentsService,
} from '../attachments/attachments.service.js';

import {
  MAINTENANCE_JOB_NAMES,
  QUEUE_NAMES,
} from './jobs.constants.js';

import {
  createWorkerRedisConnection,
} from './bullmq-connection.js';

@Injectable()
export class MaintenanceWorker
  implements
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger =
    new Logger(
      MaintenanceWorker.name,
    );

  private readonly connection;

  private worker:
    Worker | null =
    null;

  constructor(
    config:
      ConfigService,

    private readonly attachments:
      AttachmentsService,
  ) {
    this.connection =
      createWorkerRedisConnection(
        config.getOrThrow<string>(
          'REDIS_URL',
        ),
      );
  }

  async onModuleInit() {
    this.worker =
      new Worker(
        QUEUE_NAMES
          .MAINTENANCE,

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
            1,
        },
      );

    this.worker.on(
      'completed',
      (
        job,
      ) => {
        this.logger.log(
          JSON.stringify({
            event:
              'maintenance.completed',

            jobId:
              job.id,

            jobName:
              job.name,
          }),
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
          JSON.stringify({
            event:
              'maintenance.failed',

            jobId:
              job?.id ??
              null,

            jobName:
              job?.name ??
              null,

            error:
              error.name,
          }),
        );
      },
    );

    this.worker.on(
      'error',
      (
        error,
      ) => {
        this.logger.error(
          JSON.stringify({
            event:
              'maintenance.worker.error',

            error:
              error.name,
          }),
        );
      },
    );

    this.logger.log(
      'Maintenance worker started',
    );
  }

  isHealthy(): boolean {
    return (
      this.connection.status === 'ready' &&
      !!this.worker?.isRunning() &&
      !this.worker.isPaused()
    );
  }

  private async processJob(
    job:
      Job,
  ) {
    switch (
      job.name
    ) {
      case MAINTENANCE_JOB_NAMES
        .CLEANUP_ATTACHMENTS:
        return this
          .cleanupAttachments();

      default:
        throw new UnrecoverableError(
          `Unsupported maintenance job: ${job.name}`,
        );
    }
  }

  private async cleanupAttachments() {
    const result =
      await this.attachments
        .cleanupAbandonedUploads();

    this.logger.log(
      JSON.stringify({
        event:
          'attachments.cleanup',

        scanned:
          result.scanned,

        deleted:
          result.deleted,

        failed:
          result.failed,
      }),
    );

    /*
     * BullMQ should know that cleanup
     * was not completely successful.
     *
     * The job will retry, and future
     * scheduled runs can retry any
     * remaining objects as well.
     */
    if (
      result.failed >
      0
    ) {
      throw new Error(
        'Attachment cleanup completed with failures',
      );
    }

    return result;
  }

  async onModuleDestroy() {
    if (
      this.worker
    ) {
      await this.worker
        .close();
    }

    await this.connection
      .quit();

    this.logger.log(
      'Maintenance worker stopped',
    );
  }
}
