import type {
  Namespace,
  Socket,
} from 'socket.io';

import type {
  AuthPrincipal,
} from '../auth/auth.types.js';

import type {
  TenantContext,
} from '../tenancy/tenant-context.types.js';

import type {
  EmailDeliveryStatus,
} from '../generated/prisma/enums.js';

export interface RealtimeReadyPayload {
  connectedAt:
    string;
}

export interface ServerToClientEvents {
  'realtime.ready': (
    payload:
      RealtimeReadyPayload,
  ) => void;

  'organization.joined': (
    payload:
      OrganizationJoinedPayload,
  ) => void;

  'organization.left': (
    payload: {
      organizationId:
        string;
    },
  ) => void;

  'ticket.joined': (
    payload:
      TicketJoinedPayload,
  ) => void;

  'ticket.left': (
    payload:
      TicketJoinedPayload,
  ) => void;

  'ticket.created': (
    payload:
      TicketCreatedRealtimePayload,
  ) => void;

  'ticket.updated': (
    payload:
      TicketUpdatedRealtimePayload,
  ) => void;

  'ticket.message.created': (
    payload:
      TicketMessageCreatedRealtimePayload,
  ) => void;

  'email.delivery.updated': (
    payload:
      EmailDeliveryUpdatedRealtimePayload,
  ) => void;
}

export interface ClientToServerEvents {
  'organization.join': (
    payload:
      OrganizationRoomPayload,

    ack:
      OrganizationJoinAck,
  ) => void;

  'organization.leave': (
    payload:
      OrganizationRoomPayload,

    ack:
      OrganizationLeaveAck,
  ) => void;

  'ticket.join': (
    payload:
      TicketRoomPayload,

    ack:
      TicketJoinAck,
  ) => void;

  'ticket.leave': (
    payload:
      TicketRoomPayload,

    ack:
      TicketLeaveAck,
  ) => void;
}

export interface InterServerEvents {}

export type RealtimeNamespace =
  Namespace<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    RealtimeSocketData
  >;

export interface RealtimeSocketData {
  auth:
    AuthPrincipal;

  userId:
    string;

  tenants:
    Record<
      string,
      TenantContext
    >;

  tickets:
    Record<
      string,
      JoinedTicketContext
    >;
}

export type AuthenticatedSocket =
  Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    RealtimeSocketData
  >;

export interface OrganizationRoomPayload {
  organizationId:
    string;
}

export interface OrganizationJoinedPayload {
  organizationId:
    string;

  membershipId:
    string;

  role:
    string;
}

export interface RealtimeError {
  code:
    string;

  message:
    string;
}

export type OrganizationJoinAck =
  (
    result:
      | {
          ok:
            true;

          organization:
            OrganizationJoinedPayload;
        }
      | {
          ok:
            false;

          error:
            RealtimeError;
        },
  ) => void;

export type OrganizationLeaveAck =
  (
    result:
      | {
          ok:
            true;
        }
      | {
          ok:
            false;

          error:
            RealtimeError;
        },
  ) => void;

  export interface JoinedTicketContext {
  organizationId:
    string;

  ticketId:
    string;
}

export interface TicketRoomPayload {
  organizationId:
    string;

  ticketId:
    string;
}

export interface TicketJoinedPayload {
  organizationId:
    string;

  ticketId:
    string;
}

export type TicketJoinAck =
  (
    result:
      | {
          ok:
            true;

          ticket:
            TicketJoinedPayload;
        }
      | {
          ok:
            false;

          error:
            RealtimeError;
        },
  ) => void;

export type TicketLeaveAck =
  (
    result:
      | {
          ok:
            true;
        }
      | {
          ok:
            false;

          error:
            RealtimeError;
        },
  ) => void;

  export interface TicketCreatedRealtimePayload {
  organizationId:
    string;

  ticketId:
    string;

  occurredAt:
    string;
}

export interface TicketUpdatedRealtimePayload {
  organizationId:
    string;

  ticketId:
    string;

  occurredAt:
    string;
}

export interface TicketMessageCreatedRealtimePayload {
  organizationId:
    string;

  ticketId:
    string;

  messageId:
    string;

  occurredAt:
    string;
}

export interface EmailDeliveryUpdatedRealtimePayload {
  organizationId:
    string;

  ticketId:
    string;

  messageId:
    string;

  emailDeliveryId:
    string;

  status:
    EmailDeliveryStatus;

  occurredAt:
    string;
}