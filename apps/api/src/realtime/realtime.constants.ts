export const REALTIME_NAMESPACE =
  '/realtime';

export const REALTIME_EVENTS = {
  READY:
    'realtime.ready',

  ORGANIZATION_JOIN:
    'organization.join',

  ORGANIZATION_JOINED:
    'organization.joined',

  ORGANIZATION_LEAVE:
    'organization.leave',

  ORGANIZATION_LEFT:
    'organization.left',
} as const;