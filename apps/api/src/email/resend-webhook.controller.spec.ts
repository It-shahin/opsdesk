import {
  BadRequestException,
} from '@nestjs/common';

import type {
  RawBodyRequest,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type {
  Request,
} from 'express';

import {
  InboundEmailService,
} from './inbound-email.service.js';

import {
  OutboundEmailEventsService,
} from './outbound-email-events.service.js';

import {
  ResendWebhookController,
} from './resend-webhook.controller.js';

import {
  ResendWebhookVerificationService,
} from './resend-webhook-verification.service.js';

describe(
  'ResendWebhookController',
  () => {
    const handleReceivedEmailMock =
      jest.fn();

    const handleOutboundEventMock =
      jest.fn();

    const verifyMock =
      jest.fn();

    const controller =
      new ResendWebhookController(
        {
          handleReceivedEmail:
            handleReceivedEmailMock,
        } as unknown as InboundEmailService,
        {
          handle:
            handleOutboundEventMock,
        } as unknown as OutboundEmailEventsService,
        {
          verify:
            verifyMock,
        } as unknown as ResendWebhookVerificationService,
      );

    const request =
      {
        rawBody:
          Buffer.from(
            '{"type":"email.delivered"}',
          ),

        headers: {
          'svix-id':
            'webhook-message-1',

          'svix-timestamp':
            '1234567890',

          'svix-signature':
            'v1,signature',
        },
      } as unknown as RawBodyRequest<Request>;

    beforeEach(() => {
      jest.resetAllMocks();

      handleOutboundEventMock
        .mockResolvedValue({
          status:
            'processed',
        });
    });

    it(
      'verifies and routes an outbound delivery event',
      async () => {
        verifyMock
          .mockResolvedValue({
            type:
              'email.delivered',

            data: {
              email_id:
                'resend-email-1',

              tags: {
                opsdesk_delivery_id:
                  '819f42f7-5181-4eb7-9f33-256c89ff6f4c',
              },
            },
          });

        await expect(
          controller.handle(
            request,
          ),
        ).resolves.toEqual({
          received:
            true,

          result:
            'processed',
        });

        expect(
          verifyMock,
        ).toHaveBeenCalledWith(
          request.rawBody?.toString(
            'utf8',
          ),
          {
            id:
              'webhook-message-1',

            timestamp:
              '1234567890',

            signature:
              'v1,signature',
          },
        );

        expect(
          handleOutboundEventMock,
        ).toHaveBeenCalledWith(
          'email.delivered',
          {
            emailId:
              'resend-email-1',

            tags: {
              opsdesk_delivery_id:
                '819f42f7-5181-4eb7-9f33-256c89ff6f4c',
            },
          },
          {
            webhookMessageId:
              'webhook-message-1',
          },
        );
      },
    );

    it(
      'rejects a verified outbound event without an email ID',
      async () => {
        verifyMock
          .mockResolvedValue({
            type:
              'email.bounced',

            data: {},
          });

        await expect(
          controller.handle(
            request,
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(
          handleOutboundEventMock,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
