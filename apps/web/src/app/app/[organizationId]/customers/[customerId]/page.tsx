import {
  notFound,
} from 'next/navigation';

import {
  CustomerDetailView,
} from '@/components/customers/customer-detail-view';

import {
  getCustomer,
} from '@/lib/api/customers.server';

import {
  ApiServerError,
} from '@/lib/api/server';

import {
  getOrganizationForUser,
} from '@/lib/api/organizations.server';

type CustomerPageProps = {
  params:
    Promise<{
      organizationId:
        string;

      customerId:
        string;
    }>;
};

export default async function CustomerPage({
  params,
}: CustomerPageProps) {
  const {
    organizationId,
    customerId,
  } =
    await params;

  const [
    customer,
    organization,
  ] =
    await Promise.all([
      getCustomer(
        organizationId,
        customerId,
      ),

      getOrganizationForUser(
        organizationId,
      ),
    ]).catch(
      (
        error:
          unknown,
      ) => {
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
    <CustomerDetailView
      organizationId={
        organizationId
      }
      customerId={
        customerId
      }
      initialCustomer={
        customer
      }
      canWrite={
        organization.role !==
        'VIEWER'
      }
    />
  );
}