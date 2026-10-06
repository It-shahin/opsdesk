import {
  notFound,
} from 'next/navigation';

import {
  ActiveOrganizationSync,
} from '@/components/organizations/active-organization-sync';

import {
  getOrganizationForUser,
} from '@/lib/api/organizations.server';

type OrganizationLayoutProps = {
  children:
    React.ReactNode;

  params:
    Promise<{
      organizationId:
        string;
    }>;
};

export default async function OrganizationLayout({
  children,
  params,
}: OrganizationLayoutProps) {
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
    <>
      <ActiveOrganizationSync
        organizationId={
          organization.id
        }
      />

      {children}
    </>
  );
}