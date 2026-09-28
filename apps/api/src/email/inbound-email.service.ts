import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  InboundEmailProviderService,
} from './inbound-email-provider.service.js';

import {
  extractTicketIdFromRecipients,
  normalizeEmailAddress,
} from './inbound-email-routing.js';

interface EmailReceivedEvent {
  emailId:
    string;

  from:
    string;

  to:
    string[];
}

@Injectable()
export class InboundEmailService {
  private readonly logger =
    new Logger(
      InboundEmailService.name,
    );

  private readonly inboundDomain:
    string;

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly provider:
      InboundEmailProviderService,

    config:
      ConfigService,
  ) {
    this.inboundDomain =
      config.getOrThrow<string>(
        'EMAIL_INBOUND_DOMAIN',
      );
  }

  async handleReceivedEmail(
    event:
      EmailReceivedEvent,
  ) {
    /*
     * Retrieve the email again from
     * Resend rather than trusting
     * webhook fields as business data.
     */
    const received =
      await this.provider
        .getReceivedEmail(
          event.emailId,
        );

    const recipients =
      received.to?.length
        ? received.to
        : event.to;

    const ticketId =
      extractTicketIdFromRecipients(
        recipients,
        this.inboundDomain,
      );

    if (!ticketId) {
      this.logger.warn(
        'Ignoring inbound email with no ticket recipient',
      );

      return {
        status:
          'ignored' as const,

        reason:
          'unknown-recipient',
      };
    }

    const ticket =
      await this.prisma
        .ticket
        .findFirst({
          where: {
            id:
              ticketId,
          },

          select: {
            id:
              true,

            organizationId:
              true,

            status:
              true,

            customer: {
              select: {
                email:
                  true,
              },
            },
          },
        });

    if (
      !ticket ||
      !ticket.customer.email
    ) {
      this.logger.warn(
        `Ignoring inbound email for unknown ticket ${ticketId}`,
      );

      return {
        status:
          'ignored' as const,

        reason:
          'ticket-not-found',
      };
    }

    const sender =
      normalizeEmailAddress(
        received.from ??
          event.from,
      );

    const customerEmail =
      ticket.customer
        .email
        .trim()
        .toLowerCase();

    if (
      sender !==
      customerEmail
    ) {
      this.logger.warn(
        `Ignoring inbound sender mismatch for ticket ${ticketId}`,
      );

      return {
        status:
          'ignored' as const,

        reason:
          'sender-mismatch',
      };
    }

    const body =
      this.extractBody(
        received.text,
        received.html,
      );

    if (!body) {
      this.logger.warn(
        `Ignoring empty inbound email for ticket ${ticketId}`,
      );

      return {
        status:
          'ignored' as const,

        reason:
          'empty-body',
      };
    }

    const message =
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            const created =
              await transaction
                .ticketMessage
                .create({
                  data: {
                    organizationId:
                      ticket.organizationId,

                    ticketId:
                      ticket.id,

                    authorMembershipId:
                      null,

                    kind:
                      'PUBLIC_REPLY',

                    authorType:
                      'CUSTOMER',

                    source:
                      'EMAIL',

                    body,
                  },

                  select: {
                    id:
                      true,

                    ticketId:
                      true,

                    organizationId:
                      true,

                    createdAt:
                      true,
                  },
                });

            /*
             * A customer reply means
             * this ticket requires
             * agent attention again.
             */
            await transaction
              .ticket
              .updateMany({
                where: {
                  id:
                    ticket.id,

                  organizationId:
                    ticket.organizationId,

                  status: {
                    in: [
                      'PENDING',
                      'RESOLVED',
                      'CLOSED',
                    ],
                  },
                },

                data: {
                  status:
                    'OPEN',

                  resolvedAt:
                    null,

                  closedAt:
                    null,
                },
              });

            return created;
          },
        );

    this.logger.log(
      `Created inbound customer message ${message.id} for ticket ${ticket.id}`,
    );

    return {
      status:
        'created' as const,

      messageId:
        message.id,
    };
  }

  private extractBody(
    text:
      string | null | undefined,

    html:
      string | null | undefined,
  ): string {
    const plainText =
      text?.trim();

    if (
      plainText
    ) {
      return plainText.slice(
        0,
        100_000,
      );
    }

    if (!html) {
      return '';
    }

    /*
     * Minimal HTML → text fallback.
     * We store it as plain text,
     * never render this as HTML.
     */
    return html
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        ' ',
      )
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        ' ',
      )
      .replace(
        /<br\s*\/?>/gi,
        '\n',
      )
      .replace(
        /<\/p>/gi,
        '\n',
      )
      .replace(
        /<[^>]+>/g,
        ' ',
      )
      .replace(
        /[ \t]+/g,
        ' ',
      )
      .replace(
        /\n\s+/g,
        '\n',
      )
      .trim()
      .slice(
        0,
        100_000,
      );
  }
}