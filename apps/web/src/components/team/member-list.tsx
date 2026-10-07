'use client';

import {
  toast,
} from 'sonner';

import {
  useRouter,
} from 'next/navigation';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  LoaderCircle,
} from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';

import {
  Badge,
} from '@/components/ui/badge';

import {
  listMembers,
  updateMemberRole,
} from '@/lib/api/team.client';

import type {
  OrganizationRole,
} from '@/lib/organizations/types';

function initials(
  value:
    string,
) {
  return value
    .split(' ')
    .map(
      (
        part,
      ) =>
        part[0],
    )
    .join('')
    .slice(
      0,
      2,
    )
    .toUpperCase();
}

export function MemberList({
  organizationId,
  actorRole,
  currentUserId,
}: {
  organizationId:
    string;

  actorRole:
    OrganizationRole;

  currentUserId:
    string;
}) {
  const queryClient =
    useQueryClient();

  const router =
    useRouter();

  const membersQuery =
    useQuery({
      queryKey: [
        'members',
        organizationId,
      ],

      queryFn:
        () =>
          listMembers(
            organizationId,
          ),
    });

  const roleMutation =
    useMutation({
      mutationFn:
        ({
          membershipId,
          role,
        }: {
          membershipId:
            string;

          role:
            OrganizationRole;
        }) =>
          updateMemberRole(
            organizationId,
            membershipId,
            role,
          ),

      onSuccess:
        async () => {
          await Promise.all([
            queryClient
              .invalidateQueries({
                queryKey: [
                  'members',
                  organizationId,
                ],
              }),

            /*
             * Ticket assignee selects
             * use this cache.
             */
            queryClient
              .invalidateQueries({
                queryKey: [
                  'ticket-members',
                  organizationId,
                ],
              }),
          ]);

          toast.success(
            'Member role updated',
          );

          // Refresh server-rendered permissions after role changes.
          router.refresh();
        },

      onError:
        (error) => {
          toast.error(
            error.message,
          );
        },
    });

  function canManage(
    targetRole:
      OrganizationRole,
  ) {
    if (
      actorRole ===
      'OWNER'
    ) {
      return true;
    }

    if (
      actorRole ===
      'ADMIN'
    ) {
      return (
        targetRole ===
          'AGENT' ||
        targetRole ===
          'VIEWER'
      );
    }

    return false;
  }

  function allowedRoles():
    OrganizationRole[] {
    if (
      actorRole ===
      'OWNER'
    ) {
      return [
        'OWNER',
        'ADMIN',
        'AGENT',
        'VIEWER',
      ];
    }

    return [
      'AGENT',
      'VIEWER',
    ];
  }

  if (
    membersQuery.isLoading
  ) {
    return (
      <div
        className="p-6 text-sm text-muted-foreground"
      >
        Loading team…
      </div>
    );
  }

  if (
    membersQuery.isError
  ) {
    return (
      <div
        className="p-6"
      >
        <p
          className="text-sm text-destructive"
        >
          {membersQuery.error
            .message}
        </p>
      </div>
    );
  }

  return (
    <div>
      {membersQuery.data
        ?.map(
          (
            member,
          ) => {
            const displayName =
              member.user.name ??
              member.user.email;

            const editable =
              canManage(
                member.role,
              );

            return (
              <div
                key={
                  member.id
                }
                className="flex items-center gap-4 border-b p-4 last:border-b-0"
              >
                <Avatar>
                  {member.user
                    .avatarUrl && (
                    <AvatarImage
                      src={
                        member.user
                          .avatarUrl
                      }
                      alt={
                        displayName
                      }
                    />
                  )}

                  <AvatarFallback>
                    {initials(
                      displayName,
                    )}
                  </AvatarFallback>
                </Avatar>

                <div
                  className="min-w-0 flex-1"
                >
                  <div
                    className="flex flex-wrap items-center gap-2"
                  >
                    <p
                      className="truncate font-medium"
                    >
                      {displayName}
                    </p>

                    {member.user.id ===
                      currentUserId && (
                      <Badge
                        variant="secondary"
                      >
                        You
                      </Badge>
                    )}
                  </div>

                  <p
                    className="truncate text-sm text-muted-foreground"
                  >
                    {member.user.email}
                  </p>
                </div>

                {editable ? (
                  <div
                    className="flex items-center gap-2"
                  >
                    {roleMutation
                      .isPending && (
                      <LoaderCircle
                        className="size-4 animate-spin text-muted-foreground"
                      />
                    )}

                    <select
                      aria-label={`Role for ${displayName}`}
                      value={
                        member.role
                      }
                      disabled={
                        roleMutation
                          .isPending
                      }
                      onChange={
                        (
                          event,
                        ) => {
                          const role =
                            event
                              .target
                              .value as
                              OrganizationRole;

                          if (
                            role !==
                            member.role
                          ) {
                            roleMutation
                              .mutate({
                                membershipId:
                                  member.id,

                                role,
                              });
                          }
                        }
                      }
                      className="h-9 min-w-0 max-w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {allowedRoles()
                        .map(
                          (
                            role,
                          ) => (
                            <option
                              key={
                                role
                              }
                              value={
                                role
                              }
                            >
                              {role}
                            </option>
                          ),
                        )}
                    </select>
                  </div>
                ) : (
                  <Badge
                    variant="outline"
                  >
                    {member.role}
                  </Badge>
                )}
              </div>
            );
          },
        )}

      {roleMutation.isError && (
        <p
          className="border-t p-4 text-sm text-destructive"
        >
          {roleMutation.error
            .message}
        </p>
      )}
    </div>
  );
}
