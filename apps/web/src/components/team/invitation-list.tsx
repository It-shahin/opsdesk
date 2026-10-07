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
  Ban,
  Clock,
  LoaderCircle,
} from 'lucide-react';

import {
  toast,
} from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
  Badge,
} from '@/components/ui/badge';

import {
  Button,
} from '@/components/ui/button';

import {
  cancelInvitation,
  listInvitations,
} from '@/lib/api/team.client';

import type {
  OrganizationRole,
} from '@/lib/organizations/types';

function formatDate(
  value:
    string,
) {
  return new Intl
    .DateTimeFormat(
      undefined,
      {
        dateStyle:
          'medium',

        timeStyle:
          'short',
      },
    )
    .format(
      new Date(
        value,
      ),
    );
}

export function InvitationList({
  organizationId,
  actorRole,
}: {
  organizationId:
    string;

  actorRole:
    OrganizationRole;
}) {
  const queryClient =
    useQueryClient();

  const [
    selectedInvitationId,
    setSelectedInvitationId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const invitationsQuery =
    useQuery({
      queryKey: [
        'invitations',
        organizationId,
      ],

      queryFn:
        () =>
          listInvitations(
            organizationId,
          ),

      /*
       * AGENT / VIEWER do not have
       * INVITATIONS_MANAGE.
       */
      enabled:
        actorRole ===
          'OWNER' ||
        actorRole ===
          'ADMIN',
    });

  const cancelMutation =
    useMutation({
      mutationFn:
        (
          invitationId:
            string,
        ) =>
          cancelInvitation(
            organizationId,
            invitationId,
          ),

      onSuccess:
        async () => {
          setSelectedInvitationId(
            null,
          );

          await queryClient
            .invalidateQueries({
              queryKey: [
                'invitations',
                organizationId,
              ],
            });

          toast.success(
            'Invitation canceled',
          );
        },

      onError:
        (error) => {
          toast.error(
            error.message,
          );
        },
    });

  if (
    actorRole !==
      'OWNER' &&
    actorRole !==
      'ADMIN'
  ) {
    return null;
  }

  if (
    invitationsQuery.isLoading
  ) {
    return (
      <div
        className="p-5 text-sm text-muted-foreground"
      >
        Loading invitations…
      </div>
    );
  }

  if (
    invitationsQuery.isError
  ) {
    return (
      <div
        className="p-5 text-sm text-destructive"
      >
        {invitationsQuery.error
          .message}
      </div>
    );
  }

  return (
    <div>
      {invitationsQuery.data
        ?.length ===
      0 ? (
        <div
          className="p-8 text-center text-sm text-muted-foreground"
        >
          No invitations yet.
        </div>
      ) : (
        invitationsQuery.data
          ?.map(
            (
              invitation,
            ) => {
              const adminCanCancel =
                actorRole ===
                  'OWNER' ||
                invitation.role ===
                  'AGENT' ||
                invitation.role ===
                  'VIEWER';

              const cancelable =
                invitation.status ===
                  'PENDING' &&
                adminCanCancel;

              return (
                <div
                  key={
                    invitation.id
                  }
                  className="flex items-start gap-4 border-b p-4 last:border-b-0"
                >
                  <div
                    className="min-w-0 flex-1"
                  >
                    <div
                      className="flex flex-wrap items-center gap-2"
                    >
                      <p
                        className="truncate font-medium"
                      >
                        {invitation.email}
                      </p>

                      <Badge
                        variant="outline"
                      >
                        {invitation.role}
                      </Badge>

                      <Badge
                        variant={
                          invitation.status ===
                            'PENDING'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {invitation.status}
                      </Badge>
                    </div>

                    <div
                      className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
                    >
                      <span
                        className="min-w-0 max-w-full truncate"
                        title={invitation.invitedBy.name ?? invitation.invitedBy.email}
                      >
                        Invited by{' '}
                        {invitation
                          .invitedBy
                          .name ??
                          invitation
                            .invitedBy
                            .email}
                      </span>

                      {invitation.status ===
                        'PENDING' && (
                        <span
                          className="inline-flex items-center gap-1"
                        >
                          <Clock
                            className="size-3.5"
                          />

                          Expires{' '}
                          {formatDate(
                            invitation
                              .expiresAt,
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {cancelable && (
                    <AlertDialog
                      open={
                        selectedInvitationId ===
                          invitation.id
                      }
                      onOpenChange={
                        (open) => {
                          if (
                            !cancelMutation.isPending
                          ) {
                            setSelectedInvitationId(
                              open
                                ? invitation.id
                                : null,
                            );
                          }
                        }
                      }
                    >
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={
                              cancelMutation.isPending
                            }
                          />
                        }
                      >
                        <Ban
                          className="size-4"
                        />

                        Cancel
                      </AlertDialogTrigger>

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Cancel invitation?
                          </AlertDialogTitle>

                          <AlertDialogDescription>
                            The existing invitation link will stop working immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter>
                          <AlertDialogCancel
                            disabled={
                              cancelMutation.isPending
                            }
                          >
                            Keep invitation
                          </AlertDialogCancel>

                          <AlertDialogAction
                            disabled={
                              cancelMutation.isPending
                            }
                            onClick={
                              () =>
                                cancelMutation.mutate(
                                  invitation.id,
                                )
                            }
                          >
                            {cancelMutation.isPending && (
                              <LoaderCircle
                                className="size-4 animate-spin"
                              />
                            )}

                            {cancelMutation.isPending
                              ? 'Canceling…'
                              : 'Cancel invitation'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            },
          )
      )}
    </div>
  );
}
