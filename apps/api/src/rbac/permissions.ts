export const PERMISSIONS = {
  MEMBERS_READ:
    'members:read',

  MEMBERS_MANAGE:
    'members:manage',

  INVITATIONS_MANAGE:
    'invitations:manage',

  CUSTOMERS_READ:
    'customers:read',

  CUSTOMERS_WRITE:
    'customers:write',

  TICKETS_READ:
    'tickets:read',

  TICKETS_WRITE:
    'tickets:write',

  AUDIT_LOGS_READ:
    'audit-logs:read',

  ANALYTICS_READ:
  'analytics:read',
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];