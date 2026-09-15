import type { Role } from '../generated/prisma/enums.js';
import {
  PERMISSIONS,
  type Permission,
} from './permissions.js';

export const ROLE_PERMISSIONS = {
  OWNER: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_MANAGE,
    PERMISSIONS.INVITATIONS_MANAGE,
  ],

  ADMIN: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_MANAGE,
    PERMISSIONS.INVITATIONS_MANAGE,
  ],

  AGENT: [
    PERMISSIONS.MEMBERS_READ,
  ],

  VIEWER: [
    PERMISSIONS.MEMBERS_READ,
  ],
} satisfies Record<
  Role,
  readonly Permission[]
>;