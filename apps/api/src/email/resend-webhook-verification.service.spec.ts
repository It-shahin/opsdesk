import {
  BadRequestException,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type {
  Resend,
} from 'resend';

import {
  ResendWebhookVerificationService,
} from './resend-webhook-verification.service.js';

describe(
  'ResendWebhookVerificationService',
  () => {
    const verifyMock =
      jest.fn();

    const resend = {
      webhooks: {
        verify:
          verifyMock,
      },
    };

    const config = {
      getOrThrow: (
        key: string,
      ) => {
        if (
          key ===
          'RESEND_WEBHOOK_SECRET'
        ) {
          return 'whsec_test';
        }

        throw new Error(
          `Missing ${key}`,
        );
      },
    };

    let service:
      ResendWebhookVerificationService;

    beforeEach(() => {
      jest.resetAllMocks();

      service =
        new ResendWebhookVerificationService(
          resend as unknown as Resend,
          config as unknown as ConfigService,
        );
    });

    it(
      'verifies a valid Resend webhook signature',
      async () => {
        const event = {
          type:
            'email.received',

          data: {
            email_id:
              'email-id',
          },
        };

        verifyMock
          .mockResolvedValue(
            event,
          );

        await expect(
          service.verify(
            '{"type":"email.received"}',
            {
              id:
                'msg_123',

              timestamp:
                '123456',

              signature:
                'v1,signature',
            },
          ),
        ).resolves.toEqual(
          event,
        );

        expect(
          verifyMock,
        ).toHaveBeenCalledWith({
          payload:
            '{"type":"email.received"}',

          headers: {
            id:
              'msg_123',

            timestamp:
              '123456',

            signature:
              'v1,signature',
          },

          webhookSecret:
            'whsec_test',
        });
      },
    );

    it(
      'rejects an invalid Resend webhook signature',
      async () => {
        verifyMock
          .mockRejectedValue(
            new Error(
              'Invalid signature',
            ),
          );

        await expect(
          service.verify(
            '{}',
            {
              id:
                'bad',

              timestamp:
                'bad',

              signature:
                'bad',
            },
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );
  },
);
