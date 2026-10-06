import Link from 'next/link';

import {
  ArrowLeft,
} from 'lucide-react';

import {
  notFound,
} from 'next/navigation';

import {
  ApiServerError,
} from '@/lib/api/server';

import {
  getTicket,
} from '@/lib/api/tickets.server';

import {
  Badge,
} from '@/components/ui/badge';

type TicketPageProps = {
  params:
    Promise<{
      organizationId:
        string;

      ticketId:
        string;
    }>;
};

export default async function TicketPage({
  params,
}: TicketPageProps) {
  const {
    organizationId,
    ticketId,
  } =
    await params;

  let ticket;

  try {
    ticket =
      await getTicket(
        organizationId,
        ticketId,
      );
  } catch (
    error
  ) {
    if (
      error instanceof
        ApiServerError &&
      error.status ===
        404
    ) {
      notFound();
    }

    throw error;
  }

  return (
    <div
      className="mx-auto max-w-6xl space-y-6"
    >
      <Link
        href={`/app/${organizationId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft
          className="size-4"
        />

        Back to inbox
      </Link>

      <div>
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
        </div>

        <p
          className="mt-2 text-sm text-muted-foreground"
        >
          {ticket.customer.name}
        </p>
      </div>

      <div
        className="flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-background"
      >
        <p
          className="text-sm text-muted-foreground"
        >
          Conversation view arrives
          in 9D.
        </p>
      </div>
    </div>
  );
}