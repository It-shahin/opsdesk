'use client';

import {
  useEffect,
} from 'react';

import {
  useRealtime,
} from './realtime-provider';

export function TicketRealtimeBridge({
  organizationId,
  ticketId,
}: {
  organizationId:
    string;

  ticketId:
    string;
}) {
  const {
    isReady,
    joinTicket,
    leaveTicket,
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

      void joinTicket(
        organizationId,
        ticketId,
      )
        .then(
          () => {
            if (
              canceled
            ) {
              void leaveTicket(
                organizationId,
                ticketId,
              );
            }
          },
        )
        .catch(
          () => {
            // Query/HTTP authorization still protects the page.
          },
        );

      return () => {
        canceled =
          true;

        void leaveTicket(
          organizationId,
          ticketId,
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
      ticketId,
      joinTicket,
      leaveTicket,
    ],
  );

  return null;
}