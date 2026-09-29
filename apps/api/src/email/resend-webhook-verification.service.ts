import {
  BadRequestException,
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
  RESEND_INBOUND_CLIENT,
} from './email.constants.js';

export interface ResendWebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

@Injectable()
export class ResendWebhookVerificationService {
  private readonly webhookSecret:
    string;

  constructor(
    @Inject(
      RESEND_INBOUND_CLIENT,
    )
    private readonly resend:
      Resend,

    config:
      ConfigService,
  ) {
    this.webhookSecret =
      config.getOrThrow<string>(
        'RESEND_WEBHOOK_SECRET',
      );
  }

  async verify(
    payload: string,
    headers:
      ResendWebhookHeaders,
  ) {
    try {
      return await this.resend
        .webhooks
        .verify({
          payload,

          headers: {
            id:
              headers.id,

            timestamp:
              headers.timestamp,

            signature:
              headers.signature,
          },

          webhookSecret:
            this.webhookSecret,
        });
    } catch {
      throw new BadRequestException(
        'Invalid webhook signature',
      );
    }
  }
}