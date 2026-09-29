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
  RESEND_CLIENT,
} from './email.constants.js';

import {
  EmailService,
} from './email.service.js';

@Module({
  providers: [
    {
      provide:
        RESEND_CLIENT,

      inject: [
        ConfigService,
      ],

      useFactory: (
        config:
          ConfigService,
      ) => {
        const apiKey =
          config.getOrThrow<string>(
            'RESEND_API_KEY',
          );

        return new Resend(
          apiKey,
        );
      },
    },

    EmailService,
  ],

  exports: [
    EmailService,
  ],
})
export class EmailModule {}