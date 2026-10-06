'use client';

import type {
  FormEvent,
} from 'react';

import {
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query';

import {
  ArrowDownUp,
  Search,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';

import Link from 'next/link';

import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';

import {
  Button,
} from '@/components/ui/button';

import {
  Input,
} from '@/components/ui/input';

import {
  Skeleton,
} from '@/components/ui/skeleton';

import {
  listTicketMembers,
  listTickets,
  listTicketTags,
} from '@/lib/api/tickets.client';

import type {
  TicketPriority,
  TicketStatus,
} from '@/lib/tickets/types';

const statuses:
  TicketStatus[] = [
    'OPEN',
    'PENDING',
    'RESOLVED',
    'CLOSED',
  ];

const priorities:
  TicketPriority[] = [
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT',
  ];

function parsePage(
  value:
    string | null,
) {
  const parsed =
    Number(
      value,
    );

  return Number.isInteger(
    parsed,
  ) &&
    parsed > 0
    ? parsed
    : 1;
}

function formatDate(
  value:
    string,
) {
  return new Intl
    .DateTimeFormat(
      undefined,
      {
        month:
          'short',

        day:
          'numeric',

        hour:
          '2-digit',

        minute:
          '2-digit',
      },
    )
    .format(
      new Date(
        value,
      ),
    );
}

export function TicketInbox({
  organizationId,
}: {
  organizationId:
    string;
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const page =
    parsePage(
      searchParams.get(
        'page',
      ),
    );

  const searchParam =
    searchParams.get(
      'search',
    ) ??
    '';

  const status =
    searchParams.get(
      'status',
    ) as
      | TicketStatus
      | null;

  const priority =
    searchParams.get(
      'priority',
    ) as
      | TicketPriority
      | null;

  const assigneeMembershipId =
    searchParams.get(
      'assigneeMembershipId',
    ) ??
    undefined;

  const tagId =
    searchParams.get(
      'tagId',
    ) ??
    undefined;

  const sortBy =
    searchParams.get(
      'sortBy',
    ) ===
      'createdAt'
      ? 'createdAt'
      : 'updatedAt';

  const sortOrder =
    searchParams.get(
      'sortOrder',
    ) ===
      'asc'
      ? 'asc'
      : 'desc';

  const filters = {
    page,

    search:
      searchParam ||
      undefined,

    status:
      status ||
      undefined,

    priority:
      priority ||
      undefined,

    assigneeMembershipId,

    tagId,

    sortBy,

    sortOrder,
  } as const;

  const ticketsQuery =
    useQuery({
      queryKey: [
        'tickets',
        organizationId,
        filters,
      ],

      queryFn:
        () =>
          listTickets(
            organizationId,
            filters,
          ),

      placeholderData:
        keepPreviousData,
    });

  const membersQuery =
    useQuery({
      queryKey: [
        'ticket-members',
        organizationId,
      ],

      queryFn:
        () =>
          listTicketMembers(
            organizationId,
          ),

      staleTime:
        60_000,
    });

  const tagsQuery =
    useQuery({
      queryKey: [
        'ticket-tags',
        organizationId,
      ],

      queryFn:
        () =>
          listTicketTags(
            organizationId,
          ),

      staleTime:
        60_000,
    });

  function updateParams(
    changes:
      Record<
        string,
        string | null
      >,
  ) {
    const params =
      new URLSearchParams(
        searchParams
          .toString(),
      );

    for (
      const [
        key,
        value,
      ]
      of Object.entries(
        changes,
      )
    ) {
      if (
        !value
      ) {
        params.delete(
          key,
        );
      } else {
        params.set(
          key,
          value,
        );
      }
    }

    const query =
      params
        .toString();

    router.replace(
      query
        ? `${pathname}?${query}`
        : pathname,

      {
        scroll:
          false,
      },
    );
  }

  function updateFilter(
    key:
      string,

    value:
      string,
  ) {
    updateParams({
      [key]:
        value ||
        null,

      page:
        null,
    });
  }

  function submitSearch(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const search =
      new FormData(
        event.currentTarget,
      ).get('search');

    updateParams({
      search:
        typeof search === 'string'
          ? search.trim() || null
          : null,

      page:
        null,
    });
  }

  const hasFilters =
    Boolean(
      searchParam ||
      status ||
      priority ||
      assigneeMembershipId ||
      tagId,
    );

  const data =
    ticketsQuery.data;

  return (
    <div
      className="space-y-5"
    >
      <div
        className="flex flex-col gap-3 xl:flex-row"
      >
        <form
          onSubmit={
            submitSearch
          }
          className="relative min-w-0 flex-1"
        >
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />

          <Input
            aria-label="Search tickets or customers"
            key={searchParams.toString()}
            name="search"
            defaultValue={searchParam}
            placeholder="Search tickets or customers…"
            className="pl-9"
          />
        </form>

        <div
          className="flex flex-wrap gap-2"
        >
          <select
            aria-label="Status"
            value={
              status ??
              ''
            }
            onChange={
              (
                event,
              ) =>
                updateFilter(
                  'status',
                  event.target
                    .value,
                )
            }
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
          >
            <option
              value=""
            >
              All statuses
            </option>

            {statuses.map(
              (
                item,
              ) => (
                <option
                  key={
                    item
                  }
                  value={
                    item
                  }
                >
                  {item}
                </option>
              ),
            )}
          </select>

          <select
            aria-label="Priority"
            value={
              priority ??
              ''
            }
            onChange={
              (
                event,
              ) =>
                updateFilter(
                  'priority',
                  event.target
                    .value,
                )
            }
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
          >
            <option
              value=""
            >
              All priorities
            </option>

            {priorities.map(
              (
                item,
              ) => (
                <option
                  key={
                    item
                  }
                  value={
                    item
                  }
                >
                  {item}
                </option>
              ),
            )}
          </select>

          <select
            aria-label="Assignee"
            value={
              assigneeMembershipId ??
              ''
            }
            onChange={
              (
                event,
              ) =>
                updateFilter(
                  'assigneeMembershipId',
                  event.target
                    .value,
                )
            }
            disabled={
              membersQuery
                .isLoading ||
              membersQuery
                .isError
            }
            className="h-8 max-w-48 rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-50"
          >
            <option
              value=""
            >
              All assignees
            </option>

            {membersQuery
              .data
              ?.map(
                (
                  member,
                ) => (
                  <option
                    key={
                      member.id
                    }
                    value={
                      member.id
                    }
                  >
                    {member.user
                      .name ??
                      member.user
                        .email}
                  </option>
                ),
              )}
          </select>

          <select
            aria-label="Tag"
            value={
              tagId ??
              ''
            }
            onChange={
              (
                event,
              ) =>
                updateFilter(
                  'tagId',
                  event.target
                    .value,
                )
            }
            disabled={
              tagsQuery
                .isLoading ||
              tagsQuery
                .isError
            }
            className="h-8 max-w-40 rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-50"
          >
            <option
              value=""
            >
              All tags
            </option>

            {tagsQuery
              .data
              ?.map(
                (
                  tag,
                ) => (
                  <option
                    key={
                      tag.id
                    }
                    value={
                      tag.id
                    }
                  >
                    {tag.name}
                  </option>
                ),
              )}
          </select>

          <select
            aria-label="Sort tickets"
            value={
              `${sortBy}-${sortOrder}`
            }
            onChange={
              (
                event,
              ) => {
                const [
                  nextSortBy,
                  nextSortOrder,
                ] =
                  event.target
                    .value
                    .split(
                      '-',
                    );

                updateParams({
                  sortBy:
                    nextSortBy,

                  sortOrder:
                    nextSortOrder,

                  page:
                    null,
                });
              }
            }
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
          >
            <option
              value="updatedAt-desc"
            >
              Recently updated
            </option>

            <option
              value="updatedAt-asc"
            >
              Oldest update
            </option>

            <option
              value="createdAt-desc"
            >
              Newest created
            </option>

            <option
              value="createdAt-asc"
            >
              Oldest created
            </option>
          </select>

          {hasFilters && (
            <Button
              variant="ghost"
              type="button"
              onClick={
                () => {
                  updateParams({
                    search:
                      null,

                    status:
                      null,

                    priority:
                      null,

                    assigneeMembershipId:
                      null,

                    tagId:
                      null,

                    page:
                      null,
                  });
                }
              }
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-between text-sm"
      >
        <div
          className="flex items-center gap-2 text-muted-foreground"
        >
          <SlidersHorizontal
            className="size-4"
          />

          {data
            ? `${data.pagination.total} ticket${
                data.pagination
                  .total ===
                1
                  ? ''
                  : 's'
              }`
            : 'Loading tickets…'}
        </div>

        <div
          className="flex items-center gap-2 text-muted-foreground"
        >
          <ArrowDownUp
            className="size-4"
          />

          {sortBy ===
          'updatedAt'
            ? 'Updated'
            : 'Created'}
        </div>
      </div>

      {ticketsQuery
        .isLoading ? (
        <TicketInboxSkeleton />
      ) : ticketsQuery
          .isError ? (
        <div
          className="rounded-xl border bg-background p-10 text-center"
        >
          <h2
            className="font-medium"
          >
            Could not load tickets
          </h2>

          <p
            className="mt-2 text-sm text-muted-foreground"
          >
            {ticketsQuery
              .error
              .message}
          </p>

          <Button
            variant="outline"
            className="mt-5"
            onClick={
              () =>
                void ticketsQuery
                  .refetch()
            }
          >
            Try again
          </Button>
        </div>
      ) : data &&
        data.data.length ===
          0 ? (
        <div
          className="rounded-xl border border-dashed bg-background p-12 text-center"
        >
          <h2
            className="font-medium"
          >
            {hasFilters
              ? 'No matching tickets'
              : 'No tickets yet'}
          </h2>

          <p
            className="mx-auto mt-2 max-w-md text-sm text-muted-foreground"
          >
            {hasFilters
              ? 'Try changing or clearing your filters.'
              : 'New support tickets will appear here.'}
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border bg-background"
        >
          {data?.data.map(
            (
              ticket,
            ) => (
              <Link
                key={
                  ticket.id
                }
                href={`/app/${organizationId}/tickets/${ticket.id}`}
                className="block border-b p-4 transition-colors last:border-b-0 hover:bg-muted/40"
              >
                <div
                  className="flex items-start justify-between gap-4"
                >
                  <div
                    className="min-w-0"
                  >
                    <div
                      className="flex flex-wrap items-center gap-2"
                    >
                      <h2
                        className="truncate font-medium"
                      >
                        {
                          ticket.subject
                        }
                      </h2>

                      <Badge
                        variant="outline"
                      >
                        {
                          ticket.status
                        }
                      </Badge>

                      <Badge
                        variant="secondary"
                      >
                        {
                          ticket.priority
                        }
                      </Badge>
                    </div>

                    <div
                      className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
                    >
                      <span>
                        {
                          ticket.customer
                            .name
                        }
                      </span>

                      {ticket.customer
                        .company && (
                        <span>
                          {
                            ticket
                              .customer
                              .company
                          }
                        </span>
                      )}

                      <span>
                        {
                          ticket.source
                        }
                      </span>
                    </div>

                    {ticket.tags
                      .length >
                      0 && (
                      <div
                        className="mt-3 flex flex-wrap gap-1.5"
                      >
                        {ticket.tags.map(
                          (
                            tag,
                          ) => (
                            <Badge
                              key={
                                tag.id
                              }
                              variant="outline"
                              className="font-normal"
                            >
                              {
                                tag.name
                              }
                            </Badge>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className="shrink-0 text-right"
                  >
                    <p
                      className="text-xs text-muted-foreground"
                    >
                      {formatDate(
                        ticket.updatedAt,
                      )}
                    </p>

                    <div
                      className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted-foreground"
                    >
                      <UserRound
                        className="size-3.5"
                      />

                      <span
                        className="max-w-32 truncate"
                      >
                        {ticket
                          .assignee
                          ?.user
                          .name ??
                          ticket
                            .assignee
                            ?.user
                            .email ??
                          'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ),
          )}
        </div>
      )}

      {data &&
        data.pagination
          .totalPages >
          1 && (
        <div
          className="flex items-center justify-between"
        >
          <p
            className="text-sm text-muted-foreground"
          >
            Page{' '}
            {
              data.pagination
                .page
            }{' '}
            of{' '}
            {
              data.pagination
                .totalPages
            }
          </p>

          <div
            className="flex gap-2"
          >
            <Button
              variant="outline"
              disabled={
                !data.pagination
                  .hasPreviousPage
              }
              onClick={
                () =>
                  updateParams({
                    page:
                      String(
                        Math.max(
                          1,
                          page -
                            1,
                        ),
                      ),
                  })
              }
            >
              Previous
            </Button>

            <Button
              variant="outline"
              disabled={
                !data.pagination
                  .hasNextPage
              }
              onClick={
                () =>
                  updateParams({
                    page:
                      String(
                        page +
                          1,
                      ),
                  })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TicketInboxSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-background"
    >
      {Array.from({
        length:
          6,
      }).map(
        (
          _,
          index,
        ) => (
          <div
            key={
              index
            }
            className="space-y-3 border-b p-4 last:border-b-0"
          >
            <div
              className="flex items-center gap-3"
            >
              <Skeleton
                className="h-5 w-56"
              />

              <Skeleton
                className="h-5 w-16"
              />

              <Skeleton
                className="h-5 w-20"
              />
            </div>

            <Skeleton
              className="h-4 w-72"
            />
          </div>
        ),
      )}
    </div>
  );
}
