import {
  Suspense,
} from 'react';

import {
  CustomerFormDialog,
} from '@/components/customers/customer-form-dialog';

import {
  CustomerList,
} from '@/components/customers/customer-list';

import {
  getOrganizationForUser,
} from '@/lib/api/organizations.server';

import {
  notFound,
} from 'next/navigation';

type CustomersPageProps = {
  params:
    Promise<{
      organizationId:
        string;
    }>;
};

export const metadata = {
  title:
    'Customers',
};

export default async function CustomersPage({
  params,
}: CustomersPageProps) {
  const {
    organizationId,
  } =
    await params;

  const organization =
    await getOrganizationForUser(
      organizationId,
    );

  if (
    !organization
  ) {
    notFound();
  }

  const canWrite =
    organization.role !==
    'VIEWER';

  return (
    <div
      className="mx-auto max-w-7xl space-y-6"
    >
      <div
        className="flex items-start justify-between gap-4"
      >
        <div>
          <p
            className="text-sm font-medium text-muted-foreground"
          >
            {organization.name}
          </p>

          <h1
            className="mt-1 text-2xl font-semibold tracking-tight"
          >
            Customers
          </h1>

          <p
            className="mt-2 text-sm text-muted-foreground"
          >
            Manage contacts and view
            their support history.
          </p>
        </div>

        {canWrite && (
          <CustomerFormDialog
            organizationId={
              organizationId
            }
          />
        )}
      </div>

      <Suspense>
        <CustomerList
          organizationId={
            organizationId
          }
        />
      </Suspense>
    </div>
  );
}