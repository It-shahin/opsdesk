import {
  notFound,
} from 'next/navigation';

import {
  getOrganizationForUser,
} from '@/lib/api/organizations.server';

type WorkspacePageProps = {
  params:
    Promise<{
      organizationId:
        string;
    }>;
};

export default async function WorkspacePage({
  params,
}: WorkspacePageProps) {
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
      className="mx-auto max-w-6xl space-y-8"
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
          Inbox
        </h1>

        <p
          className="mt-2 text-sm text-muted-foreground"
        >
          Your support tickets will
          appear here.
        </p>
      </div>

      <div
        className="flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-background"
      >
        <p
          className="text-sm text-muted-foreground"
        >
          Ticket inbox arrives in 9C.
        </p>
      </div>
    </div>
  );
}