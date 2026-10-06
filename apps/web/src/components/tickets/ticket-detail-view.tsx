'use client';

import Link from 'next/link';

import {
  ArrowLeft,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

import {
  TicketConversation,
} from './ticket-conversation';

import {
  TicketContext,
} from './ticket-context';

import type {
  TicketDetail,
} from '@/lib/api/tickets.server';

import {
  useQuery,
} from '@tanstack/react-query';

import {
  getTicketClient,
} from '@/lib/api/tickets.client';

import {
  TicketComposer,
} from './ticket-composer';

export function TicketDetailView({
  organizationId,
  ticketId,
  initialTicket,
  canWrite,
}: {
  organizationId:
    string;

  ticketId:
    string;

  initialTicket:
    TicketDetail;

  canWrite:
    boolean;
}) {
  const ticketQuery =
    useQuery({
      queryKey: [
        'ticket',
        organizationId,
        ticketId,
      ],

      queryFn:
        () =>
          getTicketClient(
            organizationId,
            ticketId,
          ),

      initialData:
        initialTicket,
    });

  const ticket =
    ticketQuery.data;

  return (
    <div
      className="mx-auto max-w-[1500px] space-y-5"
    >
      <Link
        href={`/app/${organizationId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft
          className="size-4"
        />

        Back to inbox
      </Link>

      <div
        className="flex flex-col justify-between gap-4 md:flex-row md:items-start"
      >
        <div
          className="min-w-0"
        >
          <div
            className="flex flex-wrap items-center gap-2"
          >
            <h1
              className="text-2xl font-semibold tracking-tight"
            >
              {ticket.subject}
            </h1>

            <Badge
              variant="outline"
            >
              {ticket.status}
            </Badge>

            <Badge
              variant="secondary"
            >
              {ticket.priority}
            </Badge>
          </div>

          <p
            className="mt-2 text-sm text-muted-foreground"
          >
            {ticket.customer.name}

            {ticket.customer
              .company &&
              ` · ${ticket.customer.company}`}
          </p>
        </div>
      </div>

      <div
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <section
          className="min-w-0 overflow-hidden rounded-xl border bg-background"
        >
          {ticket.description && (
            <div
              className="border-b bg-muted/20 p-5"
            >
              <p
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Original request
              </p>

              <p
                className="mt-3 whitespace-pre-wrap text-sm leading-6"
              >
                {ticket.description}
              </p>
            </div>
          )}

          <TicketConversation
            organizationId={
              organizationId
            }
            ticketId={
              ticketId
            }
            customerName={
              ticket.customer.name
            }
          />

          <div
        className="border-t bg-muted/20 p-4"
        >
        <TicketComposer
            organizationId={
            organizationId
            }
            ticketId={
            ticketId
            }
            ticketStatus={
            ticket.status
            }
            customerEmail={
            ticket.customer
                .email
            }
            canWrite={
            canWrite
            }
        />
        </div>
        </section>

        <TicketContext
          ticket={
            ticket
          }
        />
      </div>
    </div>
  );
}
