'use client';

import {
  MessageSquare,
} from 'lucide-react';

import {
  useQuery,
} from '@tanstack/react-query';

import {
  Button,
} from '@/components/ui/button';

import {
  Skeleton,
} from '@/components/ui/skeleton';

import {
  listTicketMessages,
} from '@/lib/api/tickets.client';

import {
  ConversationMessage,
} from './conversation-message';

export function TicketConversation({
  organizationId,
  ticketId,
  customerName,
}: {
  organizationId:
    string;

  ticketId:
    string;

  customerName:
    string;
}) {
  const messages =
    useQuery({
      queryKey: [
        'ticket-messages',
        organizationId,
        ticketId,
      ],

      queryFn:
        () =>
          listTicketMessages(
            organizationId,
            ticketId,
          ),
    });

  if (
    messages.isLoading
  ) {
    return (
      <div
        className="space-y-5 p-5"
      >
        {Array.from({
          length:
            4,
        }).map(
          (
            _,
            index,
          ) => (
            <div
              key={
                index
              }
              className="space-y-2"
            >
              <Skeleton
                className="h-4 w-32"
              />

              <Skeleton
                className="h-20 w-3/4"
              />
            </div>
          ),
        )}
      </div>
    );
  }

  if (
    messages.isError
  ) {
    return (
      <div
        className="p-10 text-center"
      >
        <p
          className="font-medium"
        >
          Could not load conversation
        </p>

        <p
          className="mt-2 text-sm text-muted-foreground"
        >
          {messages.error.message}
        </p>

        <Button
          variant="outline"
          className="mt-4"
          onClick={
            () =>
              void messages.refetch()
          }
        >
          Try again
        </Button>
      </div>
    );
  }

  if (
    messages.data
      ?.length ===
    0
  ) {
    return (
      <div
        className="flex min-h-64 flex-col items-center justify-center p-8 text-center"
      >
        <MessageSquare
          className="size-8 text-muted-foreground"
        />

        <p
          className="mt-3 font-medium"
        >
          No messages yet
        </p>

        <p
          className="mt-1 text-sm text-muted-foreground"
        >
          The conversation will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 p-5"
    >
      {messages.data?.map(
        (
          message,
        ) => (
          <ConversationMessage
            key={
              message.id
            }
            organizationId={
              organizationId
            }
            ticketId={
              ticketId
            }
            customerName={
              customerName
            }
            message={
              message
            }
          />
        ),
      )}
    </div>
  );
}