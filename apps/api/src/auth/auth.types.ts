import type {
  Request,
} from 'express';

import type {
  JWTPayload,
} from 'jose';

export interface AuthPrincipal
  extends JWTPayload {
  sub: string;
}

export interface AuthenticatedSession {
  auth:
    AuthPrincipal;

  accessToken:
    string;
}

export type AuthenticatedRequest =
  Request &
    AuthenticatedSession;

export interface Auth0UserProfile {
  sub:
    string;

  email:
    string;

  emailVerified:
    boolean;

  name?:
    string;

  picture?:
    string;
}