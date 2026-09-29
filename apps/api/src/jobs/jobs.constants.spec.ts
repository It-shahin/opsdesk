import {
  describe,
  expect,
  it,
} from '@jest/globals';

import {
  EMAIL_JOB_NAMES,
  QUEUE_NAMES,
} from './jobs.constants.js';

describe(
  'jobs contracts',
  () => {
    it(
      'keeps queue names stable',
      () => {
        expect(
          QUEUE_NAMES.EMAIL,
        ).toBe(
          'email',
        );
      },
    );

    it(
      'keeps ticket email job names stable',
      () => {
        expect(
          EMAIL_JOB_NAMES
            .SEND_TICKET_REPLY,
        ).toBe(
          'email.send-ticket-reply',
        );
      },
    );
  },
);