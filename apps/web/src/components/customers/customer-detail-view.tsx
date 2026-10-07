'use client';

import Link from 'next/link';

import {
  Archive,
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  RotateCcw,
} from 'lucide-react';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  Badge,
} from '@/components/ui/badge';

import {
  Button,
} from '@/components/ui/button';

import {
  CustomerFormDialog,
} from './customer-form-dialog';

import {
  archiveCustomer,
  getCustomerClient,
  restoreCustomer,
} from '@/lib/api/customers.client';

import type {
  Customer,
} from '@/lib/customers/types';

import {
  CustomerTicketHistory,
} from './customer-ticket-history';

export function CustomerDetailView({
  organizationId,
  customerId,
  initialCustomer,
  canWrite,
}: {
  organizationId:
    string;

  customerId:
    string;

  initialCustomer:
    Customer;

  canWrite:
    boolean;
}) {
  const queryClient =
    useQueryClient();

  const customerQuery =
    useQuery({
      queryKey: [
        'customer',
        organizationId,
        customerId,
      ],

      queryFn:
        () =>
          getCustomerClient(
            organizationId,
            customerId,
          ),

      initialData:
        initialCustomer,
    });

  const customer =
    customerQuery.data;

  async function refresh() {
    await Promise.all([
      queryClient
        .invalidateQueries({
          queryKey: [
            'customer',
            organizationId,
            customerId,
          ],
        }),

      queryClient
        .invalidateQueries({
          queryKey: [
            'customers',
            organizationId,
          ],
        }),
    ]);
  }

  const archiveMutation =
    useMutation({
      mutationFn:
        () =>
          archiveCustomer(
            organizationId,
            customerId,
          ),

      onSuccess:
        refresh,
    });

  const restoreMutation =
    useMutation({
      mutationFn:
        () =>
          restoreCustomer(
            organizationId,
            customerId,
          ),

      onSuccess:
        refresh,
    });

  return (
    <div
      className="mx-auto max-w-6xl space-y-6"
    >
      <Link
        href={`/app/${organizationId}/customers`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft
          className="size-4"
        />

        Back to customers
      </Link>

      <div
        className="flex flex-col justify-between gap-4 md:flex-row md:items-start"
      >
        <div>
          <div
            className="flex flex-wrap items-center gap-2"
          >
            <h1
              className="text-2xl font-semibold tracking-tight"
            >
              {customer.name}
            </h1>

            {customer.archivedAt && (
              <Badge
                variant="secondary"
              >
                Archived
              </Badge>
            )}
          </div>

          {customer.company && (
            <p
              className="mt-2 text-sm text-muted-foreground"
            >
              {customer.company}
            </p>
          )}
        </div>

        {canWrite && (
          <div
            className="flex gap-2"
          >
            {!customer.archivedAt && (
              <CustomerFormDialog
                organizationId={
                  organizationId
                }
                customer={
                  customer
                }
              />
            )}

            {customer.archivedAt ? (
              <Button
                variant="outline"
                disabled={
                  restoreMutation
                    .isPending
                }
                onClick={
                  () =>
                    restoreMutation
                      .mutate()
                }
              >
                <RotateCcw
                  className="size-4"
                />

                Restore
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={
                  archiveMutation
                    .isPending
                }
                onClick={
                  () =>
                    archiveMutation
                      .mutate()
                }
              >
                <Archive
                  className="size-4"
                />

                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      {(archiveMutation.isError ||
        restoreMutation.isError) && (
        <p
          className="text-sm text-destructive"
        >
          {(archiveMutation.error ??
            restoreMutation.error)
            ?.message}
        </p>
      )}

      <div
        className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]"
      >
        <aside
          className="space-y-4"
        >
          <section
            className="rounded-xl border bg-background p-5"
          >
            <h2
              className="text-sm font-semibold"
            >
              Contact
            </h2>

            <div
              className="mt-4 space-y-3 text-sm"
            >
              {customer.email && (
                <Info
                  icon={
                    Mail
                  }
                >
                  {customer.email}
                </Info>
              )}

              {customer.phone && (
                <Info
                  icon={
                    Phone
                  }
                >
                  {customer.phone}
                </Info>
              )}

              {customer.company && (
                <Info
                  icon={
                    Building2
                  }
                >
                  {customer.company}
                </Info>
              )}
            </div>
          </section>

          {customer.notes && (
            <section
              className="rounded-xl border bg-background p-5"
            >
              <h2
                className="text-sm font-semibold"
              >
                Notes
              </h2>

              <p
                className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
              >
                {customer.notes}
              </p>
            </section>
          )}
        </aside>

        <CustomerTicketHistory
          organizationId={
            organizationId
          }
          customerId={
            customer.id
          }
        />
      </div>
    </div>
  );
}

function Info({
  icon:
    Icon,

  children,
}: {
  icon:
    typeof Mail;

  children:
    React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 text-muted-foreground"
    >
      <Icon
        className="size-4 shrink-0"
      />

      <span
        className="min-w-0 break-words"
      >
        {children}
      </span>
    </div>
  );
}