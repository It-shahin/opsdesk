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
  TicketDetailView,
} from '@/components/tickets/ticket-detail-view';

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
    <TicketDetailView
      organizationId={organizationId}
      ticketId={ticketId}
      initialTicket={ticket}
    />
  );
}
