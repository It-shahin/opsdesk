import { ApiResource, ApiResult } from '../openapi/api-documentation.js';
import { ApiBody } from '@nestjs/swagger';
import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { minutes, Throttle } from '@nestjs/throttler';

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
  OutboundEmailEventsService,
} from './outbound-email-events.service.js';

import type {
  OutboundEmailEventType,
} from './outbound-email-events.service.js';

import {
  ResendWebhookVerificationService,
} from './resend-webhook-verification.service.js';

@ApiResource('Webhooks')
@Controller(
  'v1/webhooks/resend',
)
export class ResendWebhookController {
  constructor(
    private readonly inboundEmail:
      InboundEmailService,

    private readonly outboundEmailEvents:
      OutboundEmailEventsService,

    private readonly verifier:
      ResendWebhookVerificationService,
  ) {}

  @ApiResult('Webhook')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'data'],
      properties: {
        type: {
          type: 'string',
          description: 'email.received or supported outbound email lifecycle event; unsupported types are acknowledged and ignored.',
        },
        data: {
          type: 'object',
          additionalProperties: true,
          description: 'Resend event data. email.received requires email_id (string), from (string), and to (array). Outbound events require email_id and correlation tags where applicable.',
        },
      },
    },
  })
  @Public()
  @Post()
  @HttpCode(200)
  @Throttle({
    default: {
      limit: 600,
      ttl: minutes(1),
    },
  })
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
      event.type ===
      'email.received'
    ) {
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

    const outboundTypes =
      new Set([
        'email.sent',
        'email.delivered',
        'email.delivery_delayed',
        'email.bounced',
        'email.complained',
        'email.suppressed',
        'email.failed',
      ]);

    if (
      outboundTypes.has(
        event.type,
      )
    ) {
      const data =
        event.data as
          | {
          email_id?:
            unknown;

          tags?:
            unknown;
            }
          | undefined;

      if (
        !data ||
        typeof data.email_id !==
          'string'
      ) {
        throw new BadRequestException(
          'Invalid outbound email event',
        );
      }

      const result =
        await this.outboundEmailEvents
          .handle(
            event.type as OutboundEmailEventType,

            {
              emailId:
                data.email_id,

              tags:
                data.tags,
            },

            {
              webhookMessageId:
                svixId,
            },
          );

      return {
        received:
          true,

        result:
          result.status,
      };
    }

    return {
      received:
        true,
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
