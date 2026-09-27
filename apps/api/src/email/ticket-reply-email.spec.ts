import {
  describe,
  expect,
  it,
} from '@jest/globals';

import {
  buildTicketReplyEmail,
} from './ticket-reply-email.js';

describe(
  'buildTicketReplyEmail',
  () => {
    it(
      'builds a ticket reply',
      () => {
        const result =
          buildTicketReplyEmail({
            customerName:
              'Alice',

            ticketSubject:
              'Login issue',

            body:
              'Your account is fixed.',
          });

        expect(
          result.subject,
        ).toBe(
          'Re: Login issue',
        );

        expect(
          result.text,
        ).toContain(
          'Your account is fixed.',
        );
      },
    );

    it(
      'does not duplicate Re prefix',
      () => {
        const result =
          buildTicketReplyEmail({
            customerName:
              'Alice',

            ticketSubject:
              'Re: Login issue',

            body:
              'Done',
          });

        expect(
          result.subject,
        ).toBe(
          'Re: Login issue',
        );
      },
    );

    it(
      'escapes user content in HTML',
      () => {
        const result =
          buildTicketReplyEmail({
            customerName:
              '<Alice>',

            ticketSubject:
              'Test',

            body:
              '<script>alert(1)</script>',
          });

        expect(
          result.html,
        ).not.toContain(
          '<script>',
        );

        expect(
          result.html,
        ).toContain(
          '&lt;script&gt;',
        );
      },
    );
  },
);