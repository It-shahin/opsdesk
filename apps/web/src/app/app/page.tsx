import {
  cookies,
} from 'next/headers';

import {
  redirect,
} from 'next/navigation';

import {
  CreateOrganizationDialog,
} from '@/components/organizations/create-organization-dialog';

import {
  getOrganizations,
} from '@/lib/api/organizations.server';

import {
  ACTIVE_ORGANIZATION_COOKIE,
} from '@/lib/organizations/constants';

export const metadata = {
  title:
    'Workspace',
};

export default async function AppHomePage() {
  const organizations =
    await getOrganizations();

  if (
    organizations.length >
    0
  ) {
    const cookieStore =
      await cookies();

    const preferredId =
      cookieStore.get(
        ACTIVE_ORGANIZATION_COOKIE,
      )?.value;

    const preferred =
      preferredId
        ? organizations.find(
            (
              organization,
            ) =>
              organization.id ===
              preferredId,
          )
        : null;

    const active =
      preferred ??
      organizations[0];

    redirect(
      `/app/${active.id}`,
    );
  }

  return (
    <div
      className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center"
    >
      <div
        className="w-full rounded-xl border border-dashed bg-background p-10 text-center"
      >
        <div
          className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-lg font-semibold"
        >
          OD
        </div>

        <h1
          className="mt-5 text-xl font-semibold"
        >
          Create your first workspace
        </h1>

        <p
          className="mx-auto mt-2 max-w-md text-sm text-muted-foreground"
        >
          Workspaces keep customers,
          tickets and team members
          separated between organizations.
        </p>

        <div
          className="mt-6 flex justify-center"
        >
          <CreateOrganizationDialog />
        </div>
      </div>
    </div>
  );
}