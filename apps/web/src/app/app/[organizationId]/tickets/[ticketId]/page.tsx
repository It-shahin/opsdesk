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

import {
  getOrganizationForUser,
} from '@/lib/api/organizations.server';

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

  const [
    ticket,
    organization,
  ] =
    await Promise.all([
      getTicket(
        organizationId,
        ticketId,
      ),

      getOrganizationForUser(
        organizationId,
      ),
    ]).catch(
      (error: unknown) => {
        if (
          error instanceof
            ApiServerError &&
          error.status ===
            404
        ) {
          notFound();
        }

        throw error;
      },
    );

  if (
    !organization
  ) {
    notFound();
  }

  return (
    <TicketDetailView
      organizationId={
        organizationId
      }
      ticketId={
        ticketId
      }
      initialTicket={
        ticket
      }
      canWrite={
        organization.role !==
        'VIEWER'
      }
    />
  );
}
