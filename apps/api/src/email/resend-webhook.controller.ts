import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';

import type {
  RawBodyRequest,
} from '@nestjs/common';

import type {
  Request,
} from 'express';

import {
  Public,
} from '../auth/public.decorator.js';

import {
  InboundEmailService,
} from './inbound-email.service.js';

import {
  ResendWebhookVerificationService,
} from './resend-webhook-verification.service.js';

@Controller(
  'v1/webhooks/resend',
)
export class ResendWebhookController {
  constructor(
    private readonly inboundEmail:
      InboundEmailService,

    private readonly verifier:
      ResendWebhookVerificationService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(
    @Req()
    request:
      RawBodyRequest<Request>,
  ) {
    const rawBody =
      request.rawBody;

    if (!rawBody) {
      throw new BadRequestException(
        'Raw webhook body is missing',
      );
    }

    const svixId =
      this.requireHeader(
        request,
        'svix-id',
      );

    const svixTimestamp =
      this.requireHeader(
        request,
        'svix-timestamp',
      );

    const svixSignature =
      this.requireHeader(
        request,
        'svix-signature',
      );

    /*
     * From this point onward,
     * "event" has been cryptographically
     * verified.
     */
    const event =
      await this.verifier.verify(
        rawBody.toString(
          'utf8',
        ),

        {
          id:
            svixId,

          timestamp:
            svixTimestamp,

          signature:
            svixSignature,
        },
      );

    if (
      event.type !==
      'email.received'
    ) {
      return {
        received:
          true,
      };
    }

    const data =
      event.data;

    if (
      !data ||
      typeof data !==
        'object' ||
      !(
        'email_id'
        in data
      ) ||
      typeof data.email_id !==
        'string' ||
      !(
        'from'
        in data
      ) ||
      typeof data.from !==
        'string' ||
      !(
        'to'
        in data
      ) ||
      !Array.isArray(
        data.to,
      )
    ) {
      throw new BadRequestException(
        'Invalid email.received event',
      );
    }

    const result =
      await this.inboundEmail
        .handleReceivedEmail(
          {
            emailId:
              data.email_id,

            from:
              data.from,

            to:
              data.to,
          },

          {
            webhookMessageId:
              svixId,

            providerEntityId:
              data.email_id,

            eventType:
              'email.received',
          },
        );

    return {
      received:
        true,

      result:
        result.status,
    };
  }

  private requireHeader(
    request:
      Request,
    name:
      string,
  ): string {
    const value =
      request.headers[
        name
      ];

    if (
      typeof value !==
      'string'
    ) {
      throw new BadRequestException(
        `Missing ${name} header`,
      );
    }

    return value;
  }
}
