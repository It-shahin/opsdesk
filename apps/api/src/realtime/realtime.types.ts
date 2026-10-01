import type {
  Socket,
} from 'socket.io';

import type {
  AuthPrincipal,
} from '../auth/auth.types.js';

import type {
  TenantContext,
} from '../tenancy/tenant-context.types.js';

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
}

export interface InterServerEvents {}

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