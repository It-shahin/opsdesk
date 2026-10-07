'use client';

import {
  useState,
} from 'react';

import {
  useQuery,
} from '@tanstack/react-query';

import Link from 'next/link';

import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/tickets/ticket-badges';

import {
  Button,
} from '@/components/ui/button';

import {
  Skeleton,
} from '@/components/ui/skeleton';

import {
  listCustomerTickets,
} from '@/lib/api/tickets.client';

export function CustomerTicketHistory({
  organizationId,
  customerId,
}: {
  organizationId:
    string;

  customerId:
    string;
}) {
  const [
    page,
    setPage,
  ] =
    useState(
      1,
    );

  const query =
    useQuery({
      queryKey: [
        'customer-tickets',
        organizationId,
        customerId,
        page,
      ],

      queryFn:
        () =>
          listCustomerTickets(
            organizationId,
            customerId,
            page,
          ),
    });

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-background"
    >
      <div
        className="border-b p-5"
      >
        <h2
          className="font-semibold"
        >
          Ticket history
        </h2>

        <p
          className="mt-1 text-sm text-muted-foreground"
        >
          Previous and active support
          conversations for this
          customer.
        </p>
      </div>

      {query.isLoading ? (
        <div
          className="space-y-4 p-5"
        >
          {Array.from({
            length:
              4,
          }).map(
            (
              _,
              index,
            ) => (
              <Skeleton
                key={
                  index
                }
                className="h-16 w-full"
              />
            ),
          )}
        </div>
      ) : query.isError ? (
        <div
          className="p-8 text-center"
        >
          <p
            className="text-sm text-destructive"
          >
            {query.error
              .message}
          </p>
        </div>
      ) : query.data
          ?.data.length ===
        0 ? (
        <div
          className="p-10 text-center text-sm text-muted-foreground"
        >
          No tickets for this
          customer yet.
        </div>
      ) : (
        <>
          <div>
            {query.data?.data.map(
              (
                ticket,
              ) => (
                <Link
                  key={
                    ticket.id
                  }
                  href={`/app/${organizationId}/tickets/${ticket.id}`}
                  className="block border-b p-4 transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div
                    className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div
                      className="min-w-0 w-full sm:flex-1"
                    >
                      <p
                        className="truncate font-medium"
                      >
                        {ticket.subject}
                      </p>

                      <div
                        className="mt-2 flex flex-wrap gap-2"
                      >
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
                    </div>

                    <span
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      {new Date(
                        ticket.updatedAt,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>

          {query.data &&
            query.data
              .pagination
              .totalPages >
              1 && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-t p-4"
            >
              <span
                className="text-sm text-muted-foreground"
              >
                Page{' '}
                {
                  query.data
                    .pagination
                    .page
                }{' '}
                of{' '}
                {
                  query.data
                    .pagination
                    .totalPages
                }
              </span>

              <div
                className="flex gap-2"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !query.data
                      .pagination
                      .hasPreviousPage
                  }
                  onClick={
                    () =>
                      setPage(
                        (
                          current,
                        ) =>
                          Math.max(
                            1,
                            current -
                              1,
                          ),
                      )
                  }
                >
                  Previous
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !query.data
                      .pagination
                      .hasNextPage
                  }
                  onClick={
                    () =>
                      setPage(
                        (
                          current,
                        ) =>
                          current +
                          1,
                      )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
