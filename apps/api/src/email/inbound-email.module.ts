import {
  Module,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  Resend,
} from 'resend';

import {
  RESEND_INBOUND_CLIENT,
} from './email.constants.js';

import {
  InboundEmailProviderService,
} from './inbound-email-provider.service.js';

import {
  InboundEmailService,
} from './inbound-email.service.js';

import {
  ResendWebhookController,
} from './resend-webhook.controller.js';

import {
  ResendWebhookVerificationService,
} from './resend-webhook-verification.service.js';

import {
  OutboundEmailEventsService,
} from './outbound-email-events.service.js';

import {
  RealtimePublisherModule,
} from '../realtime/realtime-publisher.module.js';

@Module({
  imports: [
    RealtimePublisherModule,
  ],
  
  controllers: [
    ResendWebhookController,
  ],

  providers: [
    {
      provide:
        RESEND_INBOUND_CLIENT,

      inject: [
        ConfigService,
      ],

      useFactory: (
        config:
          ConfigService,
      ) => {
        return new Resend(
          config.getOrThrow<string>(
            'RESEND_INBOUND_API_KEY',
          ),
        );
      },
    },

    InboundEmailProviderService,
    InboundEmailService,
    ResendWebhookVerificationService,
    OutboundEmailEventsService,
  ],
})
export class InboundEmailModule {}
