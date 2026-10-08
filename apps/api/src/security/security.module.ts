import {
  Module,
} from '@nestjs/common';

import {
  APP_GUARD,
} from '@nestjs/core';

import {
  minutes,
  ThrottlerModule,
} from '@nestjs/throttler';

import {
  ApiThrottlerGuard,
} from './api-throttler.guard.js';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name:
            'default',

          /*
           * Generous enough for the SPA,
           * but prevents sustained abuse.
           */
          ttl:
            minutes(1),

          limit:
            240,

          blockDuration:
            minutes(1),
        },
      ],

      /*
       * Most existing E2E tests should
       * not share rate-limit state.
       *
       * Dedicated security tests enable it.
       */
      skipIf:
        () =>
          process.env.NODE_ENV ===
            'test' &&
          process.env
            .RATE_LIMIT_TESTS !==
            '1',
    }),
  ],

  providers: [
    {
      provide:
        APP_GUARD,

      useClass:
        ApiThrottlerGuard,
    },
  ],

  exports: [
    ThrottlerModule,
  ],
})
export class SecurityModule {}