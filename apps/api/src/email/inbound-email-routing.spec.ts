import {
  describe,
  expect,
  it,
} from '@jest/globals';

import {
  buildTicketReplyAddress,
  extractTicketIdFromRecipients,
  normalizeEmailAddress,
} from './inbound-email-routing.js';

const TICKET_ID =
  '819f42f7-5181-4eb7-9f33-256c89ff6f4c';

describe(
  'inbound email routing',
  () => {
    it(
      'builds a ticket reply address',
      () => {
        expect(
          buildTicketReplyAddress(
            TICKET_ID,
            'abc.resend.app',
          ),
        ).toBe(
          `ticket-${TICKET_ID}@abc.resend.app`,
        );
      },
    );

    it(
      'extracts the ticket from recipients',
      () => {
        expect(
          extractTicketIdFromRecipients(
            [
              `ticket-${TICKET_ID}@abc.resend.app`,
            ],

            'abc.resend.app',
          ),
        ).toBe(
          TICKET_ID,
        );
      },
    );

    it(
      'ignores unrelated recipients',
      () => {
        expect(
          extractTicketIdFromRecipients(
            [
              'hello@example.com',
            ],

            'abc.resend.app',
          ),
        ).toBeNull();
      },
    );

    it(
      'normalizes named email addresses',
      () => {
        expect(
          normalizeEmailAddress(
            'Jane Doe <Jane@Example.com>',
          ),
        ).toBe(
          'jane@example.com',
        );
      },
    );
  },
);
