import type { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

export interface TenantContext {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: Role;
}

export type TenantAuthenticatedRequest =
  AuthenticatedRequest & {
    tenant?: TenantContext;
  };