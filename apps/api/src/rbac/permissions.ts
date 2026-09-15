export const PERMISSIONS = {
  MEMBERS_READ: 'members:read',
  MEMBERS_MANAGE: 'members:manage',
  INVITATIONS_MANAGE:
    'invitations:manage',
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];