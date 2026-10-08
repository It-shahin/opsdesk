import {
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import {
  ThrottlerGuard,
} from '@nestjs/throttler';

import {
  createHash,
} from 'node:crypto';

@Injectable()
export class ApiThrottlerGuard
  extends ThrottlerGuard {
  override async canActivate(
    context:
      ExecutionContext,
  ) {
    /*
     * Standard HTTP throttling must not
     * accidentally process Socket.IO
     * message handlers.
     *
     * WebSocket hardening is handled at
     * the gateway/transport boundary.
     */
    if (
      context.getType() !==
      'http'
    ) {
      return true;
    }

    return super.canActivate(
      context,
    );
  }

  protected override async getTracker(
    request:
      Record<
        string,
        any
      >,
  ): Promise<string> {
    const authorization =
      request.headers
        ?.authorization;

    if (
      typeof authorization ===
        'string' &&
      authorization.startsWith(
        'Bearer ',
      )
    ) {
      const token =
        authorization
          .slice(
            'Bearer '.length,
          )
          .trim();

      if (
        token
      ) {
        /*
         * Never store the actual
         * access token in the
         * throttler storage.
         */
        const fingerprint =
          createHash(
            'sha256',
          )
            .update(
              token,
            )
            .digest(
              'base64url',
            )
            .slice(
              0,
              32,
            );

        return `bearer:${fingerprint}`;
      }
    }

    /*
     * Public endpoints such as the
     * Resend webhook fall back to IP.
     */
    const ip =
      await super
        .getTracker(
          request,
        );

    return `ip:${ip}`;
  }
}