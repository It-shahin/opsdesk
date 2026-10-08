import {
  notFound,
} from 'next/navigation';

import {
  AnalyticsDashboard,
} from '@/components/analytics/analytics-dashboard';

import {
  getOrganizationForUser,
} from '@/lib/api/organizations.server';

type DashboardPageProps = {
  params:
    Promise<{
      organizationId:
        string;
    }>;
};

export const metadata = {
  title:
    'Dashboard',
};

export default async function DashboardPage({
  params,
}: DashboardPageProps) {
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

  return (
    <div
      className="mx-auto max-w-7xl space-y-6"
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
          Dashboard
        </h1>

        <p
          className="mt-2 text-sm text-muted-foreground"
        >
          Monitor support activity,
          workload, customers and email
          delivery health.
        </p>
      </div>

      <AnalyticsDashboard
        organizationId={
          organizationId
        }
      />
    </div>
  );
}