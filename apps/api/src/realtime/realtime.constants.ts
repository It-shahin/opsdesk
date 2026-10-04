export const REALTIME_NAMESPACE = '/realtime';

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

  TICKET_JOIN:
    'ticket.join',

  TICKET_JOINED:
    'ticket.joined',

  TICKET_LEAVE:
    'ticket.leave',

  TICKET_LEFT:
    'ticket.left',

  TICKET_CREATED:
    'ticket.created',

  TICKET_UPDATED:
    'ticket.updated',

  TICKET_MESSAGE_CREATED:
    'ticket.message.created',

  EMAIL_DELIVERY_UPDATED:
    'email.delivery.updated',
} as const;