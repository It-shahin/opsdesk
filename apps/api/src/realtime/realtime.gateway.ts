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
  OrganizationRoomPayload,
} from './realtime.types.js';

import {
  UsersService,
} from '../users/users.service.js';

import {
  TenantContextService,
} from '../tenancy/tenant-context.service.js';

import {
  organizationRoom,
  userRoom,
} from './realtime.rooms.js';

import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
} from '@nestjs/websockets';

import {
  isUUID,
} from 'class-validator';

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

  @SubscribeMessage(
  REALTIME_EVENTS
    .ORGANIZATION_JOIN,
)
async joinOrganization(
  @ConnectedSocket()
  client:
    AuthenticatedSocket,

  @MessageBody()
  payload:
    OrganizationRoomPayload,
) {
  const organizationId =
    payload?.organizationId;

  if (
    typeof organizationId !==
      'string' ||
    !isUUID(
      organizationId,
    )
  ) {
    return {
      ok:
        false,

      error: {
        code:
          'INVALID_ORGANIZATION_ID',

        message:
          'Invalid organization ID',
      },
    };
  }

  const tenant =
    await this.tenantContext
      .resolve(
        client.data.userId,
        organizationId,
      );

  if (!tenant) {
    /*
     * Same anti-enumeration idea
     * as the HTTP tenant guard.
     */
    return {
      ok:
        false,

      error: {
        code:
          'ORGANIZATION_NOT_FOUND',

        message:
          'Organization not found',
      },
    };
  }

  const room =
    organizationRoom(
      tenant.organizationId,
    );

  await client.join(
    room,
  );

  client.data.tenants[
    tenant.organizationId
  ] =
    tenant;

  const organization = {
    organizationId:
      tenant.organizationId,

    membershipId:
      tenant.membershipId,

    role:
      tenant.role,
  };

  client.emit(
    REALTIME_EVENTS
      .ORGANIZATION_JOINED,
    organization,
  );

  return {
    ok:
      true,

    organization,
  };
}

@SubscribeMessage(
  REALTIME_EVENTS
    .ORGANIZATION_LEAVE,
)
async leaveOrganization(
  @ConnectedSocket()
  client:
    AuthenticatedSocket,

  @MessageBody()
  payload:
    OrganizationRoomPayload,
) {
  const organizationId =
    payload?.organizationId;

  if (
    typeof organizationId !==
      'string' ||
    !isUUID(
      organizationId,
    )
  ) {
    return {
      ok:
        false,

      error: {
        code:
          'INVALID_ORGANIZATION_ID',

        message:
          'Invalid organization ID',
      },
    };
  }

  const tenant =
    client.data.tenants[
      organizationId
    ];

  if (!tenant) {
    return {
      ok:
        false,

      error: {
        code:
          'ORGANIZATION_NOT_JOINED',

        message:
          'Organization is not joined',
      },
    };
  }

  await client.leave(
    organizationRoom(
      organizationId,
    ),
  );

  delete client
    .data
    .tenants[
      organizationId
    ];

  client.emit(
    REALTIME_EVENTS
      .ORGANIZATION_LEFT,
    {
      organizationId,
    },
  );

  return {
    ok:
      true,
  };
}

  constructor(
  private readonly accessTokens:
    AccessTokenVerifierService,

  private readonly usersService:
    UsersService,

  private readonly tenantContext:
    TenantContextService,
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

            (
            socket as
              AuthenticatedSocket
          ).data.auth =
            principal;

          const user =
            await this.usersService
                .syncAuthenticatedUser({
                auth:
                    principal,

                accessToken:
                    token,
                });

          const client =
            socket as
                AuthenticatedSocket;

            client.data.auth =
            principal;

            client.data.userId =
            user.id;

            client.data.tenants =
            {};

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

 async handleConnection(
  client:
    AuthenticatedSocket,
) {
  await client.join(
    userRoom(
      client.data.userId,
    ),
  );

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
