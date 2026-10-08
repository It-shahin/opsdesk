import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

export function configureHttpSecurity(
  app: NestExpressApplication,
  isProduction: boolean,
) {
  app.use(
    helmet({
      // This API returns JSON. Document CSP belongs on the Next.js responses.
      contentSecurityPolicy: false,
      strictTransportSecurity: isProduction
        ? {
            maxAge: 31_536_000,
            includeSubDomains: false,
            preload: false,
          }
        : false,
      referrerPolicy: { policy: 'no-referrer' },
      xFrameOptions: { action: 'deny' },
    }),
  );

  // Nest's parsers preserve rawBody for webhook signature verification.
  app.useBodyParser('json', { limit: '64kb' });
  app.useBodyParser('urlencoded', { limit: '32kb' });
}
