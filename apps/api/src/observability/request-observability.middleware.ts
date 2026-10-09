import {
  Injectable,
  Logger,
  type NestMiddleware,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import {
  isUUID,
} from 'class-validator';

import type {
  NextFunction,
  Request,
  Response,
} from 'express';

export type RequestWithId =
  Request & {
    requestId:
      string;
  };

// The router's template preserves endpoint identity without tenant IDs, tokens,
// emails, or arbitrary customer-supplied segments. Never log a raw unmatched URL.
function logPath(request: Request): string {
  const route = request.route as { path?: unknown } | undefined;
  return typeof route?.path === 'string' ? route.path : '/[unmatched]';
}

@Injectable()
export class RequestObservabilityMiddleware
  implements NestMiddleware
{
  private readonly logger =
    new Logger(
      'HTTP',
    );

  use(
    request:
      RequestWithId,

    response:
      Response,

    next:
      NextFunction,
  ) {
    const incoming =
      request.header(
        'x-request-id',
      );

    const requestId =
      incoming &&
      isUUID(
        incoming,
        '4',
      )
        ? incoming
        : randomUUID();

    request.requestId =
      requestId;

    response.setHeader(
      'X-Request-Id',
      requestId,
    );

    const startedAt =
      Date.now();

    let finished =
      false;

    response.on(
      'finish',
      () => {
        finished =
          true;

        const durationMs =
          Date.now() -
          startedAt;

        const path =
          logPath(request);

        /*
         * Successful liveness probes
         * can be extremely noisy in
         * production logs.
         */
        if (
          request.path ===
            '/health/live' &&
          response.statusCode <
            400
        ) {
          return;
        }

        const event = {
          event:
            'http.request',

          requestId,

          method:
            request.method,

          path,

          statusCode:
            response.statusCode,

          durationMs,
        };

        const serialized =
          JSON.stringify(
            event,
          );

        if (
          response.statusCode >=
          500
        ) {
          this.logger.error(
            serialized,
          );

          return;
        }

        if (
          response.statusCode >=
          400
        ) {
          this.logger.warn(
            serialized,
          );

          return;
        }

        if (
          durationMs >=
          2_000
        ) {
          this.logger.warn(
            JSON.stringify({
              ...event,

              slow:
                true,
            }),
          );

          return;
        }

        this.logger.log(
          serialized,
        );
      },
    );

    response.on(
      'close',
      () => {
        if (
          finished
        ) {
          return;
        }

        this.logger.warn(
          JSON.stringify({
            event:
              'http.aborted',

            requestId,

            method:
              request.method,

            path:
              logPath(request),

            durationMs:
              Date.now() -
              startedAt,
          }),
        );
      },
    );

    next();
  }
}
