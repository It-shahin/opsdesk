'use client';

import type {
  FormEvent,
} from 'react';

import {
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query';

import {
  Archive,
  Building2,
  Mail,
  Search,
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
  listCustomers,
} from '@/lib/api/customers.client';

import type {
  CustomerStatusFilter,
} from '@/lib/customers/types';

function parsePage(
  value:
    string | null,
) {
  const page =
    Number(
      value,
    );

  return Number.isInteger(
    page,
  ) &&
    page > 0
    ? page
    : 1;
}

export function CustomerList({
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

  const search =
    searchParams.get(
      'search',
    ) ??
    '';

  const company =
    searchParams.get(
      'company',
    ) ??
    '';

  const rawStatus =
    searchParams.get(
      'status',
    );

  const status:
    CustomerStatusFilter =
    rawStatus ===
      'archived' ||
    rawStatus ===
      'all'
      ? rawStatus
      : 'active';

  const query =
    useQuery({
      queryKey: [
        'customers',
        organizationId,
        {
          page,
          search,
          company,
          status,
        },
      ],

      queryFn:
        () =>
          listCustomers(
            organizationId,
            {
              page,

              search:
                search ||
                undefined,

              company:
                company ||
                undefined,

              status,
            },
          ),

      placeholderData:
        keepPreviousData,
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

    const queryString =
      params.toString();

    router.replace(
      queryString
        ? `${pathname}?${queryString}`
        : pathname,

      {
        scroll:
          false,
      },
    );
  }

  function submitSearch(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const data =
      new FormData(
        event.currentTarget,
      );

    const value =
      data.get(
        'search',
      );

    updateParams({
      search:
        typeof value ===
          'string'
          ? value.trim() ||
            null
          : null,

      page:
        null,
    });
  }

  const data =
    query.data;

  return (
    <div
      className="space-y-5"
    >
      <div
        className="flex flex-col gap-3 lg:flex-row"
      >
        <form
          onSubmit={
            submitSearch
          }
          className="relative flex-1"
        >
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />

          <Input
            key={
              searchParams
                .toString()
            }
            name="search"
            defaultValue={
              search
            }
            placeholder="Search name, email, phone or company…"
            className="pl-9"
          />
        </form>

        <Input
          value={
            company
          }
          onChange={
            (
              event,
            ) =>
              updateParams({
                company:
                  event.target
                    .value ||
                  null,

                page:
                  null,
              })
          }
          placeholder="Company"
          className="lg:w-52"
        />

        <select
          value={
            status
          }
          onChange={
            (
              event,
            ) =>
              updateParams({
                status:
                  event.target
                    .value ===
                    'active'
                    ? null
                    : event.target
                        .value,

                page:
                  null,
              })
          }
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option
            value="active"
          >
            Active
          </option>

          <option
            value="archived"
          >
            Archived
          </option>

          <option
            value="all"
          >
            All
          </option>
        </select>
      </div>

      <p
        className="text-sm text-muted-foreground"
      >
        {data
          ? `${data.pagination.total} customer${
              data.pagination
                .total ===
              1
                ? ''
                : 's'
            }`
          : 'Loading customers…'}
      </p>

      {query.isLoading ? (
        <CustomerListSkeleton />
      ) : query.isError ? (
        <div
          className="rounded-xl border bg-background p-10 text-center"
        >
          <p
            className="font-medium"
          >
            Could not load customers
          </p>

          <p
            className="mt-2 text-sm text-muted-foreground"
          >
            {query.error
              .message}
          </p>

          <Button
            variant="outline"
            className="mt-4"
            onClick={
              () =>
                void query.refetch()
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
          <UserRound
            className="mx-auto size-8 text-muted-foreground"
          />

          <p
            className="mt-3 font-medium"
          >
            No customers found
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border bg-background"
        >
          {data?.data.map(
            (
              customer,
            ) => (
              <Link
                key={
                  customer.id
                }
                href={`/app/${organizationId}/customers/${customer.id}`}
                className="flex items-start justify-between gap-4 border-b p-4 transition-colors last:border-b-0 hover:bg-muted/40"
              >
                <div
                  className="min-w-0"
                >
                  <div
                    className="flex items-center gap-2"
                  >
                    <p
                      className="truncate font-medium"
                    >
                      {customer.name}
                    </p>

                    {customer.archivedAt && (
                      <Badge
                        variant="secondary"
                      >
                        Archived
                      </Badge>
                    )}
                  </div>

                  <div
                    className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"
                  >
                    {customer.email && (
                      <span
                        className="inline-flex items-center gap-1"
                      >
                        <Mail
                          className="size-3.5"
                        />

                        {customer.email}
                      </span>
                    )}

                    {customer.company && (
                      <span
                        className="inline-flex items-center gap-1"
                      >
                        <Building2
                          className="size-3.5"
                        />

                        {customer.company}
                      </span>
                    )}
                  </div>
                </div>

                {customer.archivedAt && (
                  <Archive
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                )}
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
                        page -
                          1,
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

function CustomerListSkeleton() {
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
            <Skeleton
              className="h-5 w-48"
            />

            <Skeleton
              className="h-4 w-72"
            />
          </div>
        ),
      )}
    </div>
  );
}