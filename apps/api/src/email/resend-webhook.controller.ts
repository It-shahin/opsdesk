import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';

import {
  Public,
} from '../auth/public.decorator.js';

import {
  InboundEmailService,
} from './inbound-email.service.js';

@Controller(
  'v1/webhooks/resend',
)
export class ResendWebhookController {
  constructor(
    private readonly inboundEmail:
      InboundEmailService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(
    @Body()
    payload:
      unknown,
  ) {
    if (
      !payload ||
      typeof payload !==
        'object'
    ) {
      throw new BadRequestException(
        'Invalid webhook payload',
      );
    }

    const event =
      payload as {
        type?:
          string;

        data?: {
          email_id?:
            string;

          from?:
            string;

          to?:
            string[];
        };
      };

    /*
     * Resend may eventually send
     * other events to this endpoint.
     */
    if (
      event.type !==
      'email.received'
    ) {
      return {
        received:
          true,
      };
    }

    if (
      !event.data?.email_id ||
      !event.data.from ||
      !Array.isArray(
        event.data.to,
      )
    ) {
      throw new BadRequestException(
        'Invalid email.received payload',
      );
    }

    const result =
      await this.inboundEmail
        .handleReceivedEmail({
          emailId:
            event.data
              .email_id,

          from:
            event.data
              .from,

          to:
            event.data
              .to,
        });

    return {
      received:
        true,

      result:
        result.status,
    };
  }
}
