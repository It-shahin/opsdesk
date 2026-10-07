'use client';

import {
  useEffect,
} from 'react';

import {
  useRealtime,
} from './realtime-provider';

export function OrganizationRealtimeBridge({
  organizationId,
}: {
  organizationId:
    string;
}) {
  const {
    isReady,
    joinOrganization,
    leaveOrganization,
  } =
    useRealtime();

  useEffect(
    () => {
      if (
        !isReady
      ) {
        return;
      }

      let canceled =
        false;

      void joinOrganization(
        organizationId,
      )
        .then(
          () => {
            /*
             * Navigation may have
             * occurred while the
             * join ACK was pending.
             */
            if (
              canceled
            ) {
              void leaveOrganization(
                organizationId,
              );
            }
          },
        )
        .catch(
          () => {
            // 9J can surface connection UX.
          },
        );

      return () => {
        canceled =
          true;

        void leaveOrganization(
          organizationId,
        ).catch(
          () => {
            // Cleanup remains best-effort.
          },
        );
      };
    },
    [
      isReady,
      organizationId,
      joinOrganization,
      leaveOrganization,
    ],
  );

  return null;
}