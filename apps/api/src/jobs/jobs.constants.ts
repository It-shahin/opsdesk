export const QUEUE_NAMES = {
  EMAIL: 'email',
} as const;

export const EMAIL_JOB_NAMES = {
  SMOKE_TEST:
    'email.smoke-test',

  SEND_TICKET_REPLY:
    'email.send-ticket-reply',

  RECOVER_PENDING:
    'email.recover-pending',
} as const;