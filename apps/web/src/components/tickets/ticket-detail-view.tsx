'use client';

import Link from 'next/link';

import {
  ArrowLeft,
} from 'lucide-react';

import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from './ticket-badges';

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

import {
  EditTicketDialog,
} from './edit-ticket-dialog';

import {
  TicketRealtimeBridge,
} from '@/components/realtime/ticket-realtime-bridge';

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
    <>
    <TicketRealtimeBridge
        organizationId={
        organizationId
        }
        ticketId={
        ticketId
        }
    />
    <div
      className="mx-auto max-w-[1500px] space-y-5"
    >
      <Link
        href={`/app/${organizationId}`}
        className="inline-flex items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          className="min-w-0 flex-1"
        >
          <div
            className="flex flex-wrap items-center gap-2"
          >
            <h1
              className="min-w-0 max-w-full text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]"
            >
              {ticket.subject}
            </h1>

            <TicketStatusBadge
              status={
                ticket.status
              }
            />

            <TicketPriorityBadge
              priority={
                ticket.priority
              }
            />
          </div>

          <p
            className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]"
          >
            {ticket.customer.name}

            {ticket.customer
              .company &&
              ` · ${ticket.customer.company}`}
          </p>
        </div>
        {canWrite && (
            <EditTicketDialog
                organizationId={
                organizationId
                }
                ticket={
                ticket
                }
            />
        )}
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
                className="mt-3 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]"
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
            organizationId={
                organizationId
            }
            ticket={
                ticket
            }
            canWrite={
                canWrite
            }
        />
      </div>
    </div>
    </>
  );
}
