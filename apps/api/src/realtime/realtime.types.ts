import type {
  Socket,
} from 'socket.io';

import type {
  AuthPrincipal,
} from '../auth/auth.types.js';

export interface RealtimeReadyPayload {
  connectedAt:
    string;
}

export interface ServerToClientEvents {
  'realtime.ready': (
    payload:
      RealtimeReadyPayload,
  ) => void;
}

export interface ClientToServerEvents {
  /*
   * Nothing yet.
   *
   * Organization/ticket room
   * commands come in 8B/8C.
   */
}

export interface InterServerEvents {}

export interface RealtimeSocketData {
  auth:
    AuthPrincipal;
}

export type AuthenticatedSocket =
  Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    RealtimeSocketData
  >;