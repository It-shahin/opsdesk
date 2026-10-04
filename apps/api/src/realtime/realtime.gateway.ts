import {
  Logger,
} from '@nestjs/common';

import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
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
  ticketRoom,
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

import {
  PermissionsService,
} from '../rbac/permissions.service.js';

import {
  PERMISSIONS,
} from '../rbac/permissions.js';

import {
  TicketsService,
} from '../tickets/tickets.service.js';

import type {
  TicketRoomPayload,
} from './realtime.types.js';

import {
  RealtimeService,
} from './realtime.service.js';

import type {
  RealtimeNamespace,
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

  await this.leaveAllOrganizationTickets(
    client,
    organizationId,
  );

  await client.leave(
    organizationRoom(
      organizationId,
    ),
  );

  delete client.data.tenants[organizationId];

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

  private readonly permissions:
    PermissionsService,

  private readonly ticketsService:
    TicketsService,

  private readonly realtime:
    RealtimeService,
) {}

  afterInit(
  namespace:
    Namespace,
) {
  this.realtime
    .bindNamespace(
      namespace as
        RealtimeNamespace,
    );

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

            client.data.tickets =
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

  @SubscribeMessage(
  REALTIME_EVENTS
    .TICKET_JOIN,
)
async joinTicket(
  @ConnectedSocket()
  client:
    AuthenticatedSocket,

  @MessageBody()
  payload:
    TicketRoomPayload,
) {
  const organizationId =
    payload?.organizationId;

  const ticketId =
    payload?.ticketId;

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

  if (
    typeof ticketId !==
      'string' ||
    !isUUID(
      ticketId,
    )
  ) {
    return {
      ok:
        false,

      error: {
        code:
          'INVALID_TICKET_ID',

        message:
          'Invalid ticket ID',
      },
    };
  }

  /*
   * A ticket room can only be entered
   * from an organization the socket
   * has already explicitly joined.
   */
  const joinedTenant =
    client.data.tenants[
      organizationId
    ];

  if (!joinedTenant) {
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

  /*
   * Re-resolve membership instead of
   * blindly trusting the cached role.
   *
   * Membership/role may have changed
   * while this socket stayed open.
   */
  const tenant =
    await this.tenantContext
      .resolve(
        client.data.userId,
        organizationId,
      );

  if (!tenant) {
    /*
     * Membership was removed while
     * the socket remained connected.
     */
    await this.leaveAllOrganizationTickets(
      client,
      organizationId,
    );

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

  /*
   * Refresh cached tenant context so
   * role changes are reflected.
   */
  client.data.tenants[
    organizationId
  ] =
    tenant;

  const canReadTickets =
    this.permissions
      .hasPermission(
        tenant.role,
        PERMISSIONS
          .TICKETS_READ,
      );

  if (
    !canReadTickets
  ) {
    return {
      ok:
        false,

      error: {
        code:
          'TICKET_ACCESS_DENIED',

        message:
          'Ticket access denied',
      },
    };
  }

  const exists =
    await this.ticketsService
      .existsInOrganization(
        tenant.organizationId,
        ticketId,
      );

  if (!exists) {
    /*
     * Same response whether:
     *
     * - ticket doesn't exist
     * - ticket belongs to another org
     *
     * Prevents cross-tenant
     * enumeration.
     */
    return {
      ok:
        false,

      error: {
        code:
          'TICKET_NOT_FOUND',

        message:
          'Ticket not found',
      },
    };
  }

  await client.join(
    ticketRoom(
      tenant.organizationId,
      ticketId,
    ),
  );

  client.data.tickets[
    ticketId
  ] = {
    organizationId:
      tenant.organizationId,

    ticketId,
  };

  const ticket = {
    organizationId:
      tenant.organizationId,

    ticketId,
  };

  client.emit(
    REALTIME_EVENTS
      .TICKET_JOINED,
    ticket,
  );

  return {
    ok:
      true,

    ticket,
  };
}

@SubscribeMessage(
  REALTIME_EVENTS
    .TICKET_LEAVE,
)
async leaveTicket(
  @ConnectedSocket()
  client:
    AuthenticatedSocket,

  @MessageBody()
  payload:
    TicketRoomPayload,
) {
  const organizationId =
    payload?.organizationId;

  const ticketId =
    payload?.ticketId;

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

  if (
    typeof ticketId !==
      'string' ||
    !isUUID(
      ticketId,
    )
  ) {
    return {
      ok:
        false,

      error: {
        code:
          'INVALID_TICKET_ID',

        message:
          'Invalid ticket ID',
      },
    };
  }

  const joinedTicket =
    client.data.tickets[
      ticketId
    ];

  if (
    !joinedTicket ||
    joinedTicket
      .organizationId !==
      organizationId
  ) {
    return {
      ok:
        false,

      error: {
        code:
          'TICKET_NOT_JOINED',

        message:
          'Ticket is not joined',
      },
    };
  }

  await client.leave(
    ticketRoom(
      organizationId,
      ticketId,
    ),
  );

  delete client
    .data
    .tickets[
      ticketId
    ];

  const ticket = {
    organizationId,
    ticketId,
  };

  client.emit(
    REALTIME_EVENTS
      .TICKET_LEFT,
    ticket,
  );

  return {
    ok:
      true,
  };
}

private async leaveAllOrganizationTickets(
  client:
    AuthenticatedSocket,

  organizationId:
    string,
) {
  const joinedTickets =
    Object.values(
      client.data.tickets,
    );

  for (
    const ticket
    of joinedTickets
  ) {
    if (
      ticket.organizationId !==
        organizationId
    ) {
      continue;
    }

    await client.leave(
      ticketRoom(
        ticket.organizationId,
        ticket.ticketId,
      ),
    );

    delete client
      .data
      .tickets[
        ticket.ticketId
      ];
  }
}

}
