import {
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';

import {
  Badge,
} from '@/components/ui/badge';

import {
  EmailDeliveryStatusLabel,
} from './email-delivery-status';

import {
  TicketAttachment,
} from './ticket-attachment';

import {
  formatTicketDate,
} from '@/lib/tickets/format';

import type {
  TicketMessage,
} from '@/lib/tickets/types';

function initials(
  value:
    string,
) {
  return value
    .split(' ')
    .map(
      (
        part,
      ) =>
        part[0],
    )
    .join('')
    .slice(
      0,
      2,
    )
    .toUpperCase();
}

export function ConversationMessage({
  organizationId,
  ticketId,
  customerName,
  message,
}: {
  organizationId:
    string;

  ticketId:
    string;

  customerName:
    string;

  message:
    TicketMessage;
}) {
  const internal =
    message.kind ===
    'INTERNAL_NOTE';

  const customer =
    message.authorType ===
    'CUSTOMER';

  const member =
    message.authorMembership
      ?.user;

  const authorName =
    customer
      ? customerName
      : member?.name ??
        member?.email ??
        'System';

  if (
    internal
  ) {
    return (
      <article
        className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20"
      >
        <div
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          <LockKeyhole
            className="size-4 shrink-0"
          />

          <span
            className="min-w-0 truncate text-sm font-medium"
          >
            {authorName}
          </span>

          <Badge
            variant="outline"
          >
            Internal note
          </Badge>

          <span
            className="ml-auto text-xs text-muted-foreground"
          >
            {formatTicketDate(
              message.createdAt,
            )}
          </span>
        </div>

        <p
          className="mt-3 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]"
        >
          {message.body}
        </p>

        {message.attachments
          .length >
          0 && (
          <div
            className="mt-4 space-y-2"
          >
            {message.attachments.map(
              (
                attachment,
              ) => (
                <TicketAttachment
                  key={
                    attachment.id
                  }
                  organizationId={
                    organizationId
                  }
                  ticketId={
                    ticketId
                  }
                  attachment={
                    attachment
                  }
                />
              ),
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <article
      className={`flex gap-3 ${
        customer
          ? ''
          : 'flex-row-reverse'
      }`}
    >
      <Avatar
        className="size-9 shrink-0"
      >
        {member
          ?.avatarUrl && (
          <AvatarImage
            src={
              member.avatarUrl
            }
            alt={
              authorName
            }
          />
        )}

        <AvatarFallback>
          {customer ? (
            <UserRound
              className="size-4"
            />
          ) : (
            initials(
              authorName,
            )
          )}
        </AvatarFallback>
      </Avatar>

      <div
        className={`min-w-0 max-w-[90%] sm:max-w-[80%] ${
          customer
            ? ''
            : 'text-right'
        }`}
      >
        <div
          className={`mb-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground ${
            customer
              ? ''
              : 'justify-end'
          }`}
        >
          <span
            className="min-w-0 max-w-full truncate"
          >
            {authorName}
          </span>

          {message.source ===
            'EMAIL' && (
            <Mail
              className="size-3.5 shrink-0"
            />
          )}

          <span>
            {formatTicketDate(
              message.createdAt,
            )}
          </span>
        </div>

        <div
          className={`rounded-xl border px-4 py-3 text-left ${
            customer
              ? 'bg-background'
              : 'bg-muted'
          }`}
        >
          <p
            className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]"
          >
            {message.body}
          </p>

          {message.attachments
            .length >
            0 && (
            <div
              className="mt-4 space-y-2"
            >
              {message.attachments.map(
                (
                  attachment,
                ) => (
                  <TicketAttachment
                    key={
                      attachment.id
                    }
                    organizationId={
                      organizationId
                    }
                    ticketId={
                      ticketId
                    }
                    attachment={
                      attachment
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>

        {message
          .emailDelivery && (
          <div
            className={`mt-1 ${
              customer
                ? ''
                : 'flex justify-end'
            }`}
          >
            <EmailDeliveryStatusLabel
              status={
                message
                  .emailDelivery
                  .status
              }
            />
          </div>
        )}
      </div>
    </article>
  );
}
