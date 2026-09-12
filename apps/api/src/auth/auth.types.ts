import type { JWTPayload } from 'jose';

export interface AuthPrincipal extends JWTPayload {
  sub: string;
}