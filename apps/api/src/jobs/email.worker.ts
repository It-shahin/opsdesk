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
  PrismaService,
} from '../database/prisma.service.js';

import {
  EmailService,
} from '../email/email.service.js';

import {
  buildTicketReplyEmail,
} from '../email/ticket-reply-email.js';

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
  job:
    Job<SendTicketReplyJob>,
) {
  const {
    messageId,
    organizationId,
    ticketId,
  } =
    job.data;

  const message =
    await this.prisma
      .ticketMessage
      .findFirst({
        where: {
          id:
            messageId,

          organizationId,

          ticketId,

          kind:
            'PUBLIC_REPLY',

          authorType:
            'MEMBER',
        },

        select: {
          id:
            true,

          body:
            true,

          ticket: {
            select: {
              subject:
                true,

              customer: {
                select: {
                  name:
                    true,

                  email:
                    true,
                },
              },
            },
          },
        },
      });

  if (
    !message
  ) {
    throw new UnrecoverableError(
      'Ticket reply message was not found',
    );
  }

  const customerEmail =
    message.ticket
      .customer
      .email
      ?.trim();

  if (
    !customerEmail
  ) {
    throw new UnrecoverableError(
      'Ticket customer has no email address',
    );
  }

  const email =
    buildTicketReplyEmail({
      customerName:
        message.ticket
          .customer
          .name,

      ticketSubject:
        message.ticket
          .subject,

      body:
        message.body,
    });

  const result =
    await this.emailService
      .sendTicketReply({
        messageId:
          message.id,

        to:
          customerEmail,

        ...email,
      });

  this.logger.log(
    `Sent ticket reply for message ${message.id}; provider message ${result.providerMessageId}`,
  );

  return result;
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