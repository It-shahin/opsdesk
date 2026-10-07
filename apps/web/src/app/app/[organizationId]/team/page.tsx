import {
  notFound,
} from 'next/navigation';

import {
  InviteMemberDialog,
} from '@/components/team/invite-member-dialog';

import {
  InvitationList,
} from '@/components/team/invitation-list';

import {
  MemberList,
} from '@/components/team/member-list';

import {
  getCurrentUser,
} from '@/lib/api/current-user';

import {
  getOrganizationForUser,
} from '@/lib/api/organizations.server';

type TeamPageProps = {
  params:
    Promise<{
      organizationId:
        string;
    }>;
};

export const metadata = {
  title:
    'Team',
};

export default async function TeamPage({
  params,
}: TeamPageProps) {
  const {
    organizationId,
  } =
    await params;

  const [
    organization,
    currentUser,
  ] =
    await Promise.all([
      getOrganizationForUser(
        organizationId,
      ),

      getCurrentUser(),
    ]);

  if (
    !organization
  ) {
    notFound();
  }

  const canManage =
    organization.role ===
      'OWNER' ||
    organization.role ===
      'ADMIN';

  return (
    <div
      className="mx-auto max-w-6xl space-y-6"
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
            Team
          </h1>

          <p
            className="mt-2 text-sm text-muted-foreground"
          >
            Manage workspace members,
            roles and invitations.
          </p>
        </div>

        {canManage && (
          <InviteMemberDialog
            organizationId={
              organizationId
            }
            actorRole={
              organization.role
            }
          />
        )}
      </div>

      <section
        className="overflow-hidden rounded-xl border bg-background"
      >
        <div
          className="border-b p-5"
        >
          <h2
            className="font-semibold"
          >
            Members
          </h2>

          <p
            className="mt-1 text-sm text-muted-foreground"
          >
            People with access to
            this workspace.
          </p>
        </div>

        <MemberList
          organizationId={
            organizationId
          }
          actorRole={
            organization.role
          }
          currentUserId={
            currentUser.id
          }
        />
      </section>

      {canManage && (
        <section
          className="overflow-hidden rounded-xl border bg-background"
        >
          <div
            className="border-b p-5"
          >
            <h2
              className="font-semibold"
            >
              Invitations
            </h2>

            <p
              className="mt-1 text-sm text-muted-foreground"
            >
              Pending and previous
              invitations for this
              workspace.
            </p>
          </div>

          <InvitationList
            organizationId={
              organizationId
            }
            actorRole={
              organization.role
            }
          />
        </section>
      )}
    </div>
  );
}