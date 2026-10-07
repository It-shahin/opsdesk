import 'server-only';

import {
  cache,
} from 'react';

import {
  apiServerFetch,
} from './server';

import type {
  Organization,
} from '@/lib/organizations/types';

export const getOrganizations =
  cache(
    async () =>
      apiServerFetch<
        Organization[]
      >(
        '/v1/organizations',
      ),
  );

export async function getOrganizationForUser(
  organizationId:
    string,
) {
  const organizations =
    await getOrganizations();

  return (
    organizations.find(
      (
        organization,
      ) =>
        organization.id ===
        organizationId,
    ) ?? null
  );
}