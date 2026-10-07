import type {
  EmailDeliveryStatus,
} from '@/lib/tickets/types';

export interface RealtimeReadyPayload {
  connectedAt:
    string;
}

export interface RealtimeError {
  code:
    string;

  message:
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

export interface TicketJoinedPayload {
  organizationId:
    string;

  ticketId:
    string;
}

export interface TicketCreatedPayload {
  organizationId:
    string;

  ticketId:
    string;

  occurredAt:
    string;
}

export interface TicketUpdatedPayload {
  organizationId:
    string;

  ticketId:
    string;

  occurredAt:
    string;
}

export interface TicketMessageCreatedPayload {
  organizationId:
    string;

  ticketId:
    string;

  messageId:
    string;

  occurredAt:
    string;
}

export interface EmailDeliveryUpdatedPayload {
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

export type OrganizationJoinResult =
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
    };

export type SimpleRoomResult =
  | {
      ok:
        true;
    }
  | {
      ok:
        false;

      error:
        RealtimeError;
    };

export type TicketJoinResult =
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
    };

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
      TicketCreatedPayload,
  ) => void;

  'ticket.updated': (
    payload:
      TicketUpdatedPayload,
  ) => void;

  'ticket.message.created': (
    payload:
      TicketMessageCreatedPayload,
  ) => void;

  'email.delivery.updated': (
    payload:
      EmailDeliveryUpdatedPayload,
  ) => void;
}

export interface ClientToServerEvents {
  'organization.join': (
    payload: {
      organizationId:
        string;
    },

    ack:
      (
        result:
          OrganizationJoinResult,
      ) => void,
  ) => void;

  'organization.leave': (
    payload: {
      organizationId:
        string;
    },

    ack:
      (
        result:
          SimpleRoomResult,
      ) => void,
  ) => void;

  'ticket.join': (
    payload: {
      organizationId:
        string;

      ticketId:
        string;
    },

    ack:
      (
        result:
          TicketJoinResult,
      ) => void,
  ) => void;

  'ticket.leave': (
    payload: {
      organizationId:
        string;

      ticketId:
        string;
    },

    ack:
      (
        result:
          SimpleRoomResult,
      ) => void,
  ) => void;
}