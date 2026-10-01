import {
  Logger,
} from '@nestjs/common';

import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import type {
  Namespace,
  Socket,
} from 'socket.io';

import {
  AccessTokenVerifierService,
} from '../auth/access-token-verifier.service.js';

import {
  REALTIME_EVENTS,
  REALTIME_NAMESPACE,
} from './realtime.constants.js';

import type {
  AuthenticatedSocket,
} from './realtime.types.js';

@WebSocketGateway({
  namespace:
    REALTIME_NAMESPACE,
})
export class RealtimeGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  private readonly logger =
    new Logger(
      RealtimeGateway.name,
    );

  @WebSocketServer()
  private namespace!:
    Namespace;

  constructor(
    private readonly accessTokens:
      AccessTokenVerifierService,
  ) {}

  afterInit(
  namespace: Namespace,
) {
  this.logger.log(
    `Realtime namespace initialized: ${REALTIME_NAMESPACE}`,
  );

  namespace.use(
      async (
        socket:
          Socket,
        next,
      ) => {
        try {
          const token =
            socket.handshake
              .auth?.token;

          if (
            typeof token !==
              'string' ||
            !token
          ) {
            return next(
              this.createAuthError(
                'MISSING_ACCESS_TOKEN',
                'Authentication required',
              ),
            );
          }

          const principal =
            await this.accessTokens
              .verify(
                token,
              );

          /*
           * Store only the verified
           * principal.
           *
           * Don't keep the raw bearer
           * token around unnecessarily.
           */
          (
            socket as
              AuthenticatedSocket
          ).data.auth =
            principal;

          next();
        } catch {
          next(
            this.createAuthError(
              'INVALID_ACCESS_TOKEN',
              'Authentication failed',
            ),
          );
        }
      },
    );
  }

  handleConnection(
    client:
      AuthenticatedSocket,
  ) {
    this.logger.log(
      `Realtime client connected: ${client.id}`,
    );

    client.emit(
      REALTIME_EVENTS.READY,
      {
        connectedAt:
          new Date()
            .toISOString(),
      },
    );
  }

  handleDisconnect(
    client:
      AuthenticatedSocket,
  ) {
    this.logger.log(
      `Realtime client disconnected: ${client.id}`,
    );
  }

  private createAuthError(
    code:
      string,

    message:
      string,
  ) {
    const error =
      new Error(
        message,
      ) as Error & {
        data?: {
          code:
            string;
        };
      };

    error.data = {
      code,
    };

    return error;
  }
}