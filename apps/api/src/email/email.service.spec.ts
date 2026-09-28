import {
  ConfigService,
} from '@nestjs/config';

import {
  Test,
} from '@nestjs/testing';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  RESEND_CLIENT,
} from './email.constants.js';

import {
  EmailService,
} from './email.service.js';

describe(
  'EmailService',
  () => {
    const sendMock =
      jest.fn();

    let service:
      EmailService;

    beforeEach(
      async () => {
        jest.resetAllMocks();

        const moduleRef =
          await Test
            .createTestingModule({
              providers: [
                EmailService,

                {
                  provide:
                    RESEND_CLIENT,

                  useValue: {
                    emails: {
                      send:
                        sendMock,
                    },
                  },
                },

                {
                  provide:
                    ConfigService,

                  useValue: {
                    get: (
                      key:
                        string,
                    ) => {
                      if (
                        key ===
                        'EMAIL_FROM_NAME'
                      ) {
                        return 'OpsDesk';
                      }

                      return undefined;
                    },

                    getOrThrow: (
                      key:
                        string,
                    ) => {
                      if (
                        key ===
                        'EMAIL_FROM_ADDRESS'
                      ) {
                        return 'support@example.com';
                      }

                      if (
                        key ===
                        'EMAIL_INBOUND_DOMAIN'
                      ) {
                        return 'inbound.resend.app';
                      }

                      throw new Error(
                        `Missing ${key}`,
                      );
                    },
                  },
                },
              ],
            })
            .compile();

        service =
          moduleRef.get(
            EmailService,
          );
      },
    );

    it(
      'sends ticket replies with deterministic idempotency',
      async () => {
        sendMock
          .mockResolvedValue({
            data: {
              id:
                'resend-email-id',
            },

            error:
              null,
          });

        const result =
          await service
            .sendTicketReply({
              messageId:
                'message-123',

              ticketId:
                '819f42f7-5181-4eb7-9f33-256c89ff6f4c',

              to:
                'customer@example.com',

              subject:
                'Re: Test',

              text:
                'Hello',

              html:
                '<p>Hello</p>',
            });

        expect(
          sendMock,
        ).toHaveBeenCalledWith(
          {
            from:
              'OpsDesk <support@example.com>',

            to: [
              'customer@example.com',
            ],

            replyTo:
              'ticket-819f42f7-5181-4eb7-9f33-256c89ff6f4c@inbound.resend.app',

            subject:
              'Re: Test',

            text:
              'Hello',

            html:
              '<p>Hello</p>',
          },

          {
            idempotencyKey:
              'ticket-reply/message-123',
          },
        );

        expect(
          result,
        ).toEqual({
          providerMessageId:
            'resend-email-id',
        });
      },
    );

    it(
      'throws when Resend rejects the request',
      async () => {
        sendMock
          .mockResolvedValue({
            data:
              null,

            error: {
              name:
                'validation_error',

              message:
                'Provider details',
            },
          });

        await expect(
          service.sendTicketReply({
            messageId:
              'message-123',

            ticketId:
              '819f42f7-5181-4eb7-9f33-256c89ff6f4c',

            to:
              'customer@example.com',

            subject:
              'Test',

            text:
              'Hello',

            html:
              '<p>Hello</p>',
          }),
        ).rejects.toThrow(
          'Resend email delivery failed',
        );
      },
    );
  },
);
