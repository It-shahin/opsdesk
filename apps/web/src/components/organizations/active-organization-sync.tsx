'use client';

import {
  useEffect,
} from 'react';

import {
  setActiveOrganizationPreference,
} from '@/lib/api/organizations.client';

export function ActiveOrganizationSync({
  organizationId,
}: {
  organizationId:
    string;
}) {
  useEffect(
    () => {
      void setActiveOrganizationPreference(
        organizationId,
      ).catch(
        () => {
          /*
           * Preference persistence
           * must not break navigation.
           */
        },
      );
    },
    [
      organizationId,
    ],
  );

  return null;
}