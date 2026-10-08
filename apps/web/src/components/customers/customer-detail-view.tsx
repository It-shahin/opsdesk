'use client';

import {
  toast,
} from 'sonner';

import Link from 'next/link';

import {
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
  ArchiveCustomerDialog,
} from './archive-customer-dialog';

import {
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
            'analytics',
            organizationId,
          ],
        }),

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

  const restoreMutation =
    useMutation({
      mutationFn:
        () =>
          restoreCustomer(
            organizationId,
            customerId,
          ),

      onSuccess:
        async () => {
          await refresh();

          toast.success(
            'Customer restored',
          );
        },

      onError:
        (error) => {
          toast.error(
            error.message,
          );
        },
    });

  return (
    <div
      className="mx-auto max-w-6xl space-y-6"
    >
      <Link
        href={`/app/${organizationId}/customers`}
        className="inline-flex items-center gap-2 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft
          className="size-4"
        />

        Back to customers
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
              className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]"
            >
              {customer.company}
            </p>
          )}
        </div>

        {canWrite && (
          <div
            className="flex flex-wrap gap-2"
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
              <ArchiveCustomerDialog
                organizationId={
                  organizationId
                }
                customerId={
                  customerId
                }
                customerName={
                  customer.name
                }
              />
            )}
          </div>
        )}
      </div>

      {restoreMutation.isError && (
        <p
          className="text-sm text-destructive"
        >
          {restoreMutation.error.message}
        </p>
      )}

      <div
        className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]"
      >
        <aside
          className="min-w-0 space-y-4"
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
                className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]"
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
        className="min-w-0 [overflow-wrap:anywhere]"
      >
        {children}
      </span>
    </div>
  );
}
