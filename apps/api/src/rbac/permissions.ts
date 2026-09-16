export const PERMISSIONS = {
  MEMBERS_READ: 'members:read',
  MEMBERS_MANAGE: 'members:manage',
  INVITATIONS_MANAGE: 'invitations:manage',

  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];