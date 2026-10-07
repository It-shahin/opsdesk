'use client';

import {
  useState,
} from 'react';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  LoaderCircle,
  Plus,
  X,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

import {
  Button,
} from '@/components/ui/button';

import {
  Input,
} from '@/components/ui/input';

import {
  addTicketTag,
  createTicketTag,
  listTicketMembers,
  listTicketTags,
  removeTicketTag,
  updateTicket,
  updateTicketAssignee,
  updateTicketStatus,
} from '@/lib/api/tickets.client';

import type {
  TicketDetail,
} from '@/lib/api/tickets.server';

import {
  invalidateTicketData,
} from '@/lib/tickets/invalidate';

import type {
  TicketPriority,
  TicketStatus,
} from '@/lib/tickets/types';

const statuses:
  TicketStatus[] = [
    'OPEN',
    'PENDING',
    'RESOLVED',
    'CLOSED',
  ];

const priorities:
  TicketPriority[] = [
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT',
  ];

const transitions:
  Record<
    TicketStatus,
    readonly TicketStatus[]
  > = {
    OPEN: [
      'PENDING',
      'RESOLVED',
    ],

    PENDING: [
      'OPEN',
      'RESOLVED',
    ],

    RESOLVED: [
      'OPEN',
      'CLOSED',
    ],

    CLOSED: [
      'OPEN',
    ],
  };

export function TicketControls({
  organizationId,
  ticket,
  canWrite,
}: {
  organizationId:
    string;

  ticket:
    TicketDetail;

  canWrite:
    boolean;
}) {
  const queryClient =
    useQueryClient();

  const [
    newTagName,
    setNewTagName,
  ] =
    useState(
      '',
    );

  const membersQuery =
    useQuery({
      queryKey: [
        'ticket-members',
        organizationId,
      ],

      queryFn:
        () =>
          listTicketMembers(
            organizationId,
          ),

      staleTime:
        60_000,
    });

  const tagsQuery =
    useQuery({
      queryKey: [
        'ticket-tags',
        organizationId,
      ],

      queryFn:
        () =>
          listTicketTags(
            organizationId,
          ),

      staleTime:
        60_000,
    });

  async function refresh() {
    await invalidateTicketData(
      queryClient,
      organizationId,
      ticket.id,
    );
  }

  const statusMutation =
    useMutation({
      mutationFn:
        (
          status:
            TicketStatus,
        ) =>
          updateTicketStatus(
            organizationId,
            ticket.id,
            status,
          ),

      onSuccess:
        refresh,
    });

  const priorityMutation =
    useMutation({
      mutationFn:
        (
          priority:
            TicketPriority,
        ) =>
          updateTicket(
            organizationId,
            ticket.id,
            {
              priority,
            },
          ),

      onSuccess:
        refresh,
    });

  const assigneeMutation =
    useMutation({
      mutationFn:
        (
          membershipId:
            string | null,
        ) =>
          updateTicketAssignee(
            organizationId,
            ticket.id,
            membershipId,
          ),

      onSuccess:
        refresh,
    });

  const addTagMutation =
    useMutation({
      mutationFn:
        (
          tagId:
            string,
        ) =>
          addTicketTag(
            organizationId,
            ticket.id,
            tagId,
          ),

      onSuccess:
        refresh,
    });

  const removeTagMutation =
    useMutation({
      mutationFn:
        (
          tagId:
            string,
        ) =>
          removeTicketTag(
            organizationId,
            ticket.id,
            tagId,
          ),

      onSuccess:
        refresh,
    });

  const createTagMutation =
    useMutation({
      mutationFn:
        async (
          name:
            string,
        ) => {
          const tag =
            await createTicketTag(
              organizationId,
              name,
            );

          await addTicketTag(
            organizationId,
            ticket.id,
            tag.id,
          );

          return tag;
        },

      onSuccess:
        async () => {
          setNewTagName(
            '',
          );

          await Promise.all([
            refresh(),

            queryClient
              .invalidateQueries({
                queryKey: [
                  'ticket-tags',
                  organizationId,
                ],
              }),
          ]);
        },
    });

  if (
    !canWrite
  ) {
    return (
      <p
        className="text-sm text-muted-foreground"
      >
        Ticket controls are
        read-only for your role.
      </p>
    );
  }

  const activeTagIds =
    new Set(
      ticket.tags.map(
        (
          tag,
        ) =>
          tag.id,
      ),
    );

  const availableTags =
    tagsQuery.data
      ?.filter(
        (
          tag,
        ) =>
          !activeTagIds.has(
            tag.id,
          ),
      ) ??
    [];

  const assignableMembers =
    membersQuery.data
      ?.filter(
        (
          member,
        ) =>
          member.role !==
          'VIEWER',
      ) ??
    [];

  const mutationError =
    statusMutation.error ??
    priorityMutation.error ??
    assigneeMutation.error ??
    addTagMutation.error ??
    removeTagMutation.error ??
    createTagMutation.error;

  return (
    <div
      className="space-y-5"
    >
      <Control
        label="Status"
      >
        <select
          value={
            ticket.status
          }
          disabled={
            statusMutation
              .isPending
          }
          onChange={
            (
              event,
            ) => {
              const status =
                event.target
                  .value as
                  TicketStatus;

              if (
                status !==
                ticket.status
              ) {
                statusMutation
                  .mutate(
                    status,
                  );
              }
            }
          }
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none"
        >
          {statuses.map(
            (
              status,
            ) => {
              const allowed =
                status ===
                  ticket.status ||
                transitions[
                  ticket.status
                ].includes(
                  status,
                );

              return (
                <option
                  key={
                    status
                  }
                  value={
                    status
                  }
                  disabled={
                    !allowed
                  }
                >
                  {status}
                </option>
              );
            },
          )}
        </select>
      </Control>

      <Control
        label="Priority"
      >
        <select
          value={
            ticket.priority
          }
          disabled={
            priorityMutation
              .isPending
          }
          onChange={
            (
              event,
            ) => {
              const priority =
                event.target
                  .value as
                  TicketPriority;

              if (
                priority !==
                ticket.priority
              ) {
                priorityMutation
                  .mutate(
                    priority,
                  );
              }
            }
          }
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none"
        >
          {priorities.map(
            (
              priority,
            ) => (
              <option
                key={
                  priority
                }
                value={
                  priority
                }
              >
                {priority}
              </option>
            ),
          )}
        </select>
      </Control>

      <Control
        label="Assignee"
      >
        <select
          value={
            ticket.assignee
              ?.id ??
            ''
          }
          disabled={
            assigneeMutation
              .isPending ||
            membersQuery
              .isLoading
          }
          onChange={
            (
              event,
            ) =>
              assigneeMutation
                .mutate(
                  event.target
                    .value ||
                    null,
                )
          }
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none"
        >
          <option
            value=""
          >
            Unassigned
          </option>

          {assignableMembers.map(
            (
              member,
            ) => (
              <option
                key={
                  member.id
                }
                value={
                  member.id
                }
              >
                {member.user
                  .name ??
                  member.user
                    .email}
              </option>
            ),
          )}
        </select>
      </Control>

      <div>
        <p
          className="text-xs text-muted-foreground"
        >
          Tags
        </p>

        {ticket.tags.length >
        0 ? (
          <div
            className="mt-2 flex flex-wrap gap-1.5"
          >
            {ticket.tags.map(
              (
                tag,
              ) => (
                <Badge
                  key={
                    tag.id
                  }
                  variant="outline"
                  className="gap-1 pr-1"
                >
                  {tag.name}

                  <button
                    type="button"
                    disabled={
                      removeTagMutation
                        .isPending
                    }
                    onClick={
                      () =>
                        removeTagMutation
                          .mutate(
                            tag.id,
                          )
                    }
                    className="rounded-sm p-0.5 hover:bg-muted"
                    aria-label={`Remove ${tag.name}`}
                  >
                    <X
                      className="size-3"
                    />
                  </button>
                </Badge>
              ),
            )}
          </div>
        ) : (
          <p
            className="mt-2 text-sm text-muted-foreground"
          >
            No tags
          </p>
        )}

        {availableTags.length >
          0 && (
          <select
            value=""
            disabled={
              addTagMutation
                .isPending
            }
            onChange={
              (
                event,
              ) => {
                if (
                  event.target
                    .value
                ) {
                  addTagMutation
                    .mutate(
                      event.target
                        .value,
                    );
                }
              }
            }
            className="mt-3 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none"
          >
            <option
              value=""
            >
              Add existing tag…
            </option>

            {availableTags.map(
              (
                tag,
              ) => (
                <option
                  key={
                    tag.id
                  }
                  value={
                    tag.id
                  }
                >
                  {tag.name}
                </option>
              ),
            )}
          </select>
        )}

        <form
          className="mt-2 flex gap-2"
          onSubmit={
            (
              event,
            ) => {
              event.preventDefault();

              const name =
                newTagName
                  .trim();

              if (
                name
              ) {
                createTagMutation
                  .mutate(
                    name,
                  );
              }
            }
          }
        >
          <Input
            value={
              newTagName
            }
            onChange={
              (
                event,
              ) =>
                setNewTagName(
                  event.target
                    .value,
                )
            }
            disabled={
              createTagMutation
                .isPending
            }
            placeholder="New tag"
          />

          <Button
            type="submit"
            size="icon"
            variant="outline"
            disabled={
              !newTagName
                .trim() ||
              createTagMutation
                .isPending
            }
            aria-label="Create tag"
          >
            {createTagMutation
              .isPending ? (
              <LoaderCircle
                className="size-4 animate-spin"
              />
            ) : (
              <Plus
                className="size-4"
              />
            )}
          </Button>
        </form>
      </div>

      {mutationError && (
        <p
          className="text-sm text-destructive"
        >
          {mutationError
            .message}
        </p>
      )}
    </div>
  );
}

function Control({
  label,
  children,
}: {
  label:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <div>
      <p
        className="mb-2 text-xs text-muted-foreground"
      >
        {label}
      </p>

      {children}
    </div>
  );
}