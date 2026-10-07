import {
  apiClientFetch,
} from './client';

import type {
  Organization,
} from '@/lib/organizations/types';

export function createOrganization(
  name:
    string,
) {
  return apiClientFetch<
    Organization
  >(
    '/api/organizations',
    {
      method:
        'POST',

      body:
        JSON.stringify({
          name,
        }),
    },
  );
}

export async function setActiveOrganizationPreference(
  organizationId:
    string,
) {
  await apiClientFetch<{
    ok:
      true;
  }>(
    '/api/active-organization',
    {
      method:
        'POST',

      body:
        JSON.stringify({
          organizationId,
        }),
    },
  );
}