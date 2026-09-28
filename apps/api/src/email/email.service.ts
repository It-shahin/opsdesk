import {
  Inject,
  Injectable,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import type {
  Resend,
} from 'resend';

import {
  RESEND_CLIENT,
} from './email.constants.js';

import {
  buildTicketReplyAddress,
} from './inbound-email-routing.js';

interface SendTicketReplyInput {
  messageId:
    string;

  ticketId:
    string;

  to:
    string;

  subject:
    string;

  text:
    string;

  html:
    string;
}

@Injectable()
export class EmailService {
  private readonly from:
    string;
  private readonly inboundDomain:
    string;

  constructor(
    @Inject(
      RESEND_CLIENT,
    )
    private readonly resend:
      Resend,

    config:
      ConfigService,
  ) {
    const name =
      config.get<string>(
        'EMAIL_FROM_NAME',
      )?.trim() ||
      'OpsDesk Support';

    const address =
      config.getOrThrow<string>(
        'EMAIL_FROM_ADDRESS',
      );

    this.from =
      `${name} <${address}>`;

    this.inboundDomain =
      config.getOrThrow<string>(
        'EMAIL_INBOUND_DOMAIN',
      );
  }

  async sendTicketReply(
    input:
      SendTicketReplyInput,
  ) {

    const replyTo =
      buildTicketReplyAddress(
        input.ticketId,
        this.inboundDomain,
      );

    const {
  data,
  error,
} =
  await this.resend
    .emails
    .send(
      {
        from:
          this.from,

        to: [
          input.to,
        ],

        replyTo,

        subject:
          input.subject,

        text:
          input.text,

        html:
          input.html,
      },

      {
        idempotencyKey:
          `ticket-reply/${input.messageId}`,
      },
    );

    if (
      error
    ) {
      /*
       * Do not include recipient/body
       * in thrown/logged errors.
       */
      throw new Error(
        `Resend email delivery failed: ${error.name}`,
      );
    }

    if (
      !data?.id
    ) {
      throw new Error(
        'Resend did not return an email ID',
      );
    }

    return {
      providerMessageId:
        data.id,
    };
  }
}