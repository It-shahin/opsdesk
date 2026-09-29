import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import type {
  EmailDeliveryStatus,
} from '../generated/prisma/enums.js';

export type OutboundEmailEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.suppressed'
  | 'email.failed';

type DeliveryTransition = {
  allowedFrom:
    EmailDeliveryStatus[];

  data: {
    status:
      EmailDeliveryStatus;

    sentAt?:
      Date;

    deliveredAt?:
      Date;

    failedAt?:
      Date;
  };
};

@Injectable()
export class OutboundEmailEventsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async handle(
    eventType:
      OutboundEmailEventType,

    data: {
      emailId:
        string;

      tags?:
        unknown;
    },

    identity: {
      webhookMessageId:
        string;
    },
  ) {
    const deliveryId =
      this.extractDeliveryId(
        data.tags,
      );

    const delivery =
      deliveryId
        ? await this.prisma
            .emailDelivery
            .findUnique({
              where: {
                id:
                  deliveryId,
              },
            })
        : await this.prisma
            .emailDelivery
            .findUnique({
              where: {
                providerMessageId:
                  data.emailId,
              },
            });

    if (!delivery) {
      return {
        status:
          'ignored' as const,
      };
    }

    const mapped =
      this.mapStatus(
        eventType,
      );

    try {
      await this.prisma
        .$transaction(
          async (
            tx,
          ) => {
            await tx.webhookEvent
              .create({
                data: {
                  provider:
                    'RESEND',

                  eventType,

                  providerEntityId:
                    data.emailId,

                  webhookMessageId:
                    identity
                      .webhookMessageId,

                  status:
                    'PROCESSED',
                },
              });

            await tx.emailDelivery
              .updateMany({
                where: {
                  id:
                    delivery.id,

                  OR: [
                    {
                      providerMessageId:
                        null,
                    },

                    {
                      providerMessageId:
                        data.emailId,
                    },
                  ],
                },

                data: {
                  providerMessageId:
                    data.emailId,
                },
              });

            await tx.emailDelivery
              .updateMany({
                where: {
                  id:
                    delivery.id,

                  status: {
                    in:
                      mapped.allowedFrom,
                  },
                },

                data:
                  mapped.data,
              });
          },
        );

      return {
        status:
          'processed' as const,
      };
    } catch (error) {
      if (
        this.isUniqueConstraintError(
          error,
        )
      ) {
        return {
          status:
            'duplicate' as const,
        };
      }

      throw error;
    }
  }

  private mapStatus(
    eventType:
      OutboundEmailEventType,
  ): DeliveryTransition {
    const now =
      new Date();

    switch (
      eventType
    ) {
      case 'email.sent':
        return {
          allowedFrom: [
            'PENDING',
            'SENDING',
            'SENT',
          ],

          data: {
            status:
              'SENT',

            sentAt:
              now,
          },
        };

      case 'email.delivery_delayed':
        return {
          allowedFrom: [
            'PENDING',
            'SENDING',
            'SENT',
            'DELAYED',
          ],

          data: {
            status:
              'DELAYED',
          },
        };

      case 'email.delivered':
        return {
          allowedFrom: [
            'PENDING',
            'SENDING',
            'SENT',
            'DELAYED',
          ],

          data: {
            status:
              'DELIVERED',

            deliveredAt:
              now,
          },
        };

      case 'email.bounced':
        return this.failureStatus(
          'BOUNCED',
          now,
        );

      case 'email.complained':
        return this.failureStatus(
          'COMPLAINED',
          now,
        );

      case 'email.suppressed':
        return this.failureStatus(
          'SUPPRESSED',
          now,
        );

      case 'email.failed':
        return this.failureStatus(
          'FAILED',
          now,
        );
    }
  }

  private failureStatus(
    status:
      | 'BOUNCED'
      | 'COMPLAINED'
      | 'SUPPRESSED'
      | 'FAILED',

    now:
      Date,
  ): DeliveryTransition {
    return {
      allowedFrom: [
        'PENDING',
        'SENDING',
        'SENT',
        'DELAYED',
      ],

      data: {
        status,

        failedAt:
          now,
      },
    };
  }

  private extractDeliveryId(
    tags:
      unknown,
  ): string | null {
    if (
      !tags ||
      typeof tags !==
        'object'
    ) {
      return null;
    }

    const value =
      (
        tags as Record<
          string,
          unknown
        >
      )
        .opsdesk_delivery_id;

    return typeof value ===
      'string'
      ? value
      : null;
  }

  private isUniqueConstraintError(
    error:
      unknown,
  ): boolean {
    if (
      typeof error !==
        'object' ||
      error ===
        null ||
      !(
        'code'
        in error
      )
    ) {
      return false;
    }

    return (
      error as {
        code?:
          unknown;
      }
    ).code ===
      'P2002';
  }
}
