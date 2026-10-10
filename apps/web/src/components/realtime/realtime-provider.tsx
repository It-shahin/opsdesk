'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useQueryClient,
} from '@tanstack/react-query';

import {
  io,
  type Socket,
} from 'socket.io-client';

import {
  toast,
} from 'sonner';

import type {
  ClientToServerEvents,
  OrganizationJoinResult,
  ServerToClientEvents,
  SimpleRoomResult,
  TicketJoinResult,
} from '@/lib/realtime/types';

type RealtimeSocket =
  Socket<
    ServerToClientEvents,
    ClientToServerEvents
  >;

interface RealtimeContextValue {
  isReady:
    boolean;

  error:
    string | null;

  joinOrganization:
    (
      organizationId:
        string,
    ) => Promise<void>;

  leaveOrganization:
    (
      organizationId:
        string,
    ) => Promise<void>;

  joinTicket:
    (
      organizationId:
        string,
      ticketId:
        string,
    ) => Promise<void>;

  leaveTicket:
    (
      organizationId:
        string,
      ticketId:
        string,
    ) => Promise<void>;
}

const RealtimeContext =
  createContext<
    RealtimeContextValue |
    null
  >(
    null,
  );

function waitForAck<T>(
  emit:
    (
      resolve:
        (
          result:
            T,
        ) => void,
    ) => void,
) {
  return new Promise<T>(
    (
      resolve,
      reject,
    ) => {
      const timeout =
        window.setTimeout(
          () => {
            reject(
              new Error(
                'Realtime request timed out',
              ),
            );
          },
          5_000,
        );

      emit(
        (
          result,
        ) => {
          window.clearTimeout(
            timeout,
          );

          resolve(
            result,
          );
        },
      );
    },
  );
}

function ticketRoomKey(
  organizationId:
    string,

  ticketId:
    string,
) {
  return `${organizationId}:${ticketId}`;
}

export function RealtimeProvider({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const queryClient =
    useQueryClient();

  const hasConnected =
    useRef(
      false,
    );

  const hasRecovered = useRef(false);

  const socketRef =
    useRef<
      RealtimeSocket |
      null
    >(
      null,
    );

  const joinedOrganizations =
    useRef(
      new Set<
        string
      >(),
    );

  const organizationJoins =
    useRef(
      new Map<
        string,
        Promise<void>
      >(),
    );

  const joinedTickets =
    useRef(
      new Set<
        string
      >(),
    );

  const ticketJoins =
    useRef(
      new Map<
        string,
        Promise<void>
      >(),
    );

  const [
    isReady,
    setIsReady,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      process.env.NEXT_PUBLIC_REALTIME_URL
        ? null
        : 'Realtime URL is not configured',
    );

  const joinOrganization =
    useCallback(
      async (
        organizationId:
          string,
      ) => {
        if (
          joinedOrganizations
            .current
            .has(
              organizationId,
            )
        ) {
          return;
        }

        const existing =
          organizationJoins
            .current
            .get(
              organizationId,
            );

        if (
          existing
        ) {
          return existing;
        }

        const socket =
          socketRef.current;

        if (
          !socket ||
          !socket.connected
        ) {
          throw new Error(
            'Realtime connection is not ready',
          );
        }

        const promise =
          waitForAck<
            OrganizationJoinResult
          >(
            (
              resolve,
            ) => {
              socket.emit(
                'organization.join',
                {
                  organizationId,
                },
                resolve,
              );
            },
          )
            .then(
              (
                result,
              ) => {
                if (
                  !result.ok
                ) {
                  throw new Error(
                    result.error
                      .message,
                  );
                }

                joinedOrganizations
                  .current
                  .add(
                    organizationId,
                  );
                if (hasRecovered.current) {
                  // Subscribe before refetching so writes in the recovery gap
                  // are covered by either the snapshot or a subsequent event.
                  void queryClient.invalidateQueries({
                    predicate: ({ queryKey }) =>
                      queryKey[1] === organizationId &&
                      ['tickets', 'ticket', 'customer-tickets', 'analytics']
                        .includes(String(queryKey[0])),
                  });
                }
              },
            )
            .finally(
              () => {
                organizationJoins
                  .current
                  .delete(
                    organizationId,
                  );
              },
            );

        organizationJoins
          .current
          .set(
            organizationId,
            promise,
          );

        return promise;
      },
      [queryClient],
    );

  const leaveOrganization =
    useCallback(
      async (
        organizationId:
          string,
      ) => {
        const socket =
          socketRef.current;

        joinedOrganizations
          .current
          .delete(
            organizationId,
          );

        organizationJoins
          .current
          .delete(
            organizationId,
          );

        for (
          const key
          of joinedTickets
            .current
        ) {
          if (
            key.startsWith(
              `${organizationId}:`,
            )
          ) {
            joinedTickets
              .current
              .delete(
                key,
              );
          }
        }

        if (
          !socket ||
          !socket.connected
        ) {
          return;
        }

        const result =
          await waitForAck<
            SimpleRoomResult
          >(
            (
              resolve,
            ) => {
              socket.emit(
                'organization.leave',
                {
                  organizationId,
                },
                resolve,
              );
            },
          );

        if (
          !result.ok &&
          result.error.code !==
            'ORGANIZATION_NOT_JOINED'
        ) {
          throw new Error(
            result.error.message,
          );
        }
      },
      [],
    );

  const joinTicket =
    useCallback(
      async (
        organizationId:
          string,

        ticketId:
          string,
      ) => {
        await joinOrganization(
          organizationId,
        );

        const key =
          ticketRoomKey(
            organizationId,
            ticketId,
          );

        if (
          joinedTickets
            .current
            .has(
              key,
            )
        ) {
          return;
        }

        const existing =
          ticketJoins
            .current
            .get(
              key,
            );

        if (
          existing
        ) {
          return existing;
        }

        const socket =
          socketRef.current;

        if (
          !socket ||
          !socket.connected
        ) {
          throw new Error(
            'Realtime connection is not ready',
          );
        }

        const promise =
          waitForAck<
            TicketJoinResult
          >(
            (
              resolve,
            ) => {
              socket.emit(
                'ticket.join',
                {
                  organizationId,
                  ticketId,
                },
                resolve,
              );
            },
          )
            .then(
              (
                result,
              ) => {
                if (
                  !result.ok
                ) {
                  throw new Error(
                    result.error
                      .message,
                  );
                }

                joinedTickets
                  .current
                  .add(
                    key,
                  );
                if (hasRecovered.current) {
                  // Delivery updates use ticket rooms, so reconcile after this
                  // ACK too rather than relying on the organization snapshot.
                  void queryClient.invalidateQueries({
                    queryKey: ['ticket-messages', organizationId, ticketId],
                  });
                }
              },
            )
            .finally(
              () => {
                ticketJoins
                  .current
                  .delete(
                    key,
                  );
              },
            );

        ticketJoins
          .current
          .set(
            key,
            promise,
          );

        return promise;
      },
      [
        joinOrganization,
        queryClient,
      ],
    );

  const leaveTicket =
    useCallback(
      async (
        organizationId:
          string,

        ticketId:
          string,
      ) => {
        const key =
          ticketRoomKey(
            organizationId,
            ticketId,
          );

        const socket =
          socketRef.current;

        joinedTickets
          .current
          .delete(
            key,
          );

        ticketJoins
          .current
          .delete(
            key,
          );

        if (
          !socket ||
          !socket.connected
        ) {
          return;
        }

        const result =
          await waitForAck<
            SimpleRoomResult
          >(
            (
              resolve,
            ) => {
              socket.emit(
                'ticket.leave',
                {
                  organizationId,
                  ticketId,
                },
                resolve,
              );
            },
          );

        if (
          !result.ok &&
          result.error.code !==
            'TICKET_NOT_JOINED'
        ) {
          throw new Error(
            result.error.message,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      function invalidateAnalytics(organizationId: string) {
        void queryClient.invalidateQueries({
          queryKey: ['analytics', organizationId],
        });
      }

      const realtimeUrl =
        process.env
          .NEXT_PUBLIC_REALTIME_URL;

      if (
        !realtimeUrl
      ) {
        return;
      }

      const socket:
        RealtimeSocket =
        io(
          `${realtimeUrl}/realtime`,
          {
            autoConnect:
              false,

            /*
             * WebSocket-only avoids
             * long-polling session
             * affinity requirements.
             */
            transports: [
              'websocket',
            ],

            reconnection:
              true,

            reconnectionAttempts:
              Infinity,

            reconnectionDelay:
              1_000,

            reconnectionDelayMax:
              5_000,

            auth:
              (
                callback,
              ) => {
                void fetch(
                  '/api/realtime/token',
                  {
                    cache:
                      'no-store',
                  },
                )
                  .then(
                    async (
                      response,
                    ) => {
                      if (
                        !response.ok
                      ) {
                        throw new Error(
                          'Could not authenticate realtime connection',
                        );
                      }

                      const data =
                        await response
                          .json() as {
                            token:
                              string;
                          };

                      callback({
                        token:
                          data.token,
                      });
                    },
                  )
                  .catch(
                    () => {
                      callback({
                        token:
                          '',
                      });
                    },
                  );
              },
          },
        );

      socketRef.current =
        socket;

      socket.on(
        'realtime.ready',
        () => {
          if (
            hasConnected.current
          ) {
            hasRecovered.current = true;
            toast.success(
              'Realtime connection restored',
              { id: 'realtime-restored' },
            );
          }

          hasConnected.current =
            true;

          setError(
            null,
          );

          setIsReady(
            true,
          );
        },
      );

      socket.on(
        'connect_error',
        (
          connectError,
        ) => {
          setIsReady(
            false,
          );

          setError(
            connectError
              .message ||
              'Realtime connection failed',
          );
        },
      );

      socket.on(
        'disconnect',
        () => {
          setIsReady(
            false,
          );

          joinedOrganizations
            .current
            .clear();

          organizationJoins
            .current
            .clear();

          joinedTickets
            .current
            .clear();

          ticketJoins
            .current
            .clear();
        },
      );

      socket.on(
        'ticket.created',
        (
          payload,
        ) => {
          invalidateAnalytics(payload.organizationId);

          void queryClient
            .invalidateQueries({
              queryKey: [
                'tickets',
                payload
                  .organizationId,
              ],
            });

          void queryClient
            .invalidateQueries({
              queryKey: [
                'customer-tickets',
                payload
                  .organizationId,
              ],
            });
        },
      );

      socket.on(
        'ticket.updated',
        (
          payload,
        ) => {
          invalidateAnalytics(payload.organizationId);

          void queryClient
            .invalidateQueries({
              queryKey: [
                'ticket',
                payload
                  .organizationId,
                payload
                  .ticketId,
              ],
            });

          void queryClient
            .invalidateQueries({
              queryKey: [
                'tickets',
                payload
                  .organizationId,
              ],
            });

          void queryClient
            .invalidateQueries({
              queryKey: [
                'customer-tickets',
                payload
                  .organizationId,
              ],
            });
        },
      );

      socket.on(
        'ticket.message.created',
        (
          payload,
        ) => {
          invalidateAnalytics(payload.organizationId);

          void queryClient
            .invalidateQueries({
              queryKey: [
                'ticket-messages',
                payload
                  .organizationId,
                payload
                  .ticketId,
              ],
            });

          void queryClient
            .invalidateQueries({
              queryKey: [
                'ticket',
                payload
                  .organizationId,
                payload
                  .ticketId,
              ],
            });

          void queryClient
            .invalidateQueries({
              queryKey: [
                'tickets',
                payload
                  .organizationId,
              ],
            });

          void queryClient
            .invalidateQueries({
              queryKey: [
                'customer-tickets',
                payload
                  .organizationId,
              ],
            });
        },
      );

      socket.on(
        'email.delivery.updated',
        (
          payload,
        ) => {
          invalidateAnalytics(payload.organizationId);

          void queryClient
            .invalidateQueries({
              queryKey: [
                'ticket-messages',
                payload
                  .organizationId,
                payload
                  .ticketId,
              ],
            });
        },
      );

      socket.connect();

      return () => {
        socket.removeAllListeners();
        socket.disconnect();

        socketRef.current =
          null;

        joinedOrganizations
          .current
          .clear();

        joinedTickets
          .current
          .clear();
      };
    },
    [
      queryClient,
    ],
  );

  const value =
    useMemo(
      () => ({
        isReady,
        error,
        joinOrganization,
        leaveOrganization,
        joinTicket,
        leaveTicket,
      }),
      [
        isReady,
        error,
        joinOrganization,
        leaveOrganization,
        joinTicket,
        leaveTicket,
      ],
    );

  return (
    <RealtimeContext.Provider
      value={
        value
      }
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context =
    useContext(
      RealtimeContext,
    );

  if (
    !context
  ) {
    throw new Error(
      'useRealtime must be used inside RealtimeProvider',
    );
  }

  return context;
}
