import {
  notFound,
} from 'next/navigation';

import {
  getOrganizationForUser,
} from '@/lib/api/organizations.server';

import {
  TicketInbox,
} from '@/components/tickets/ticket-inbox';

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
          Search and filter your
          workspace&apos;s support tickets.
        </p>
      </div>

      <TicketInbox
        key={organization.id}
        organizationId={organization.id}
      />
    </div>
  );
}
