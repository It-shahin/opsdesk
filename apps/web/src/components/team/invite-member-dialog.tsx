'use client';

import {
  toast,
} from 'sonner';

import {
  FormEvent,
  useState,
} from 'react';

import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  Check,
  Copy,
  LoaderCircle,
  UserPlus,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import {
  Input,
} from '@/components/ui/input';

import {
  Label,
} from '@/components/ui/label';

import {
  createInvitation,
} from '@/lib/api/team.client';

import type {
  OrganizationRole,
} from '@/lib/organizations/types';

export function InviteMemberDialog({
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
    open,
    setOpen,
  ] =
    useState(
      false,
    );

  const [
    email,
    setEmail,
  ] =
    useState(
      '',
    );

  const [
    role,
    setRole,
  ] =
    useState<
      OrganizationRole
    >(
      'AGENT',
    );

  const [
    inviteLink,
    setInviteLink,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    copied,
    setCopied,
  ] =
    useState(
      false,
    );

  const roles:
    OrganizationRole[] =
    actorRole ===
      'OWNER'
      ? [
          'OWNER',
          'ADMIN',
          'AGENT',
          'VIEWER',
        ]
      : [
          'AGENT',
          'VIEWER',
        ];

  const mutation =
    useMutation({
      mutationFn:
        () =>
          createInvitation(
            organizationId,
            {
              email:
                email.trim(),

              role,
            },
          ),

      onSuccess:
        async (
          invitation,
        ) => {
          /*
           * Token is intentionally
           * returned only once.
           */
          const link =
            `${window.location.origin}/invite/${encodeURIComponent(
              invitation
                .acceptanceToken,
            )}`;

          setInviteLink(
            link,
          );

          await queryClient
            .invalidateQueries({
              queryKey: [
                'invitations',
                organizationId,
              ],
            });

          toast.success(
            'Invitation created',
          );
        },

      onError:
        (error) => {
          toast.error(
            error.message,
          );
        },
    });

  function reset() {
    setEmail(
      '',
    );

    setRole(
      'AGENT',
    );

    setInviteLink(
      null,
    );

    setCopied(
      false,
    );

    mutation.reset();
  }

  function changeOpen(
    next:
      boolean,
  ) {
    setOpen(
      next,
    );

    if (
      !next
    ) {
      reset();
    }
  }

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !email.trim()
    ) {
      return;
    }

    mutation.mutate();
  }

  async function copy() {
    if (
      !inviteLink
    ) {
      return;
    }

    await navigator
      .clipboard
      .writeText(
        inviteLink,
      );

    setCopied(
      true,
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={
        changeOpen
      }
    >
      <DialogTrigger
        render={
          <Button />
        }
      >
        <UserPlus
          className="size-4"
        />

        Invite member
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-md"
      >
        {inviteLink ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Invitation created
              </DialogTitle>

              <DialogDescription>
                Share this link with
                the invited person.
                It expires after
                seven days.
              </DialogDescription>
            </DialogHeader>

            <div
              className="py-6"
            >
              <Label
                htmlFor="invite-link"
              >
                Invitation link
              </Label>

              <div
                className="mt-2 flex min-w-0 gap-2"
              >
                <Input
                  id="invite-link"
                  className="min-w-0 flex-1"
                  readOnly
                  value={
                    inviteLink
                  }
                />

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={
                    () =>
                      void copy()
                  }
                  aria-label="Copy invitation link"
                >
                  {copied ? (
                    <Check
                      className="size-4"
                    />
                  ) : (
                    <Copy
                      className="size-4"
                    />
                  )}
                </Button>
              </div>

              <p
                className="mt-3 text-xs text-muted-foreground"
              >
                OpsDesk stores only a
                hash of this token.
                This raw link cannot
                be recovered later.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={
                  () =>
                    changeOpen(
                      false,
                    )
                }
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={
              submit
            }
          >
            <DialogHeader>
              <DialogTitle>
                Invite team member
              </DialogTitle>

              <DialogDescription>
                Create a seven-day
                invitation for this
                workspace.
              </DialogDescription>
            </DialogHeader>

            <div
              className="space-y-4 py-6"
            >
              <div>
                <Label
                  htmlFor="invite-email"
                >
                  Email
                </Label>

                <Input
                  id="invite-email"
                  type="email"
                  value={
                    email
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setEmail(
                        event
                          .target
                          .value,
                      )
                  }
                  className="mt-2"
                  required
                />
              </div>

              <div>
                <Label
                  htmlFor="invite-role"
                >
                  Role
                </Label>

                <select
                  id="invite-role"
                  value={
                    role
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setRole(
                        event
                          .target
                          .value as
                          OrganizationRole,
                      )
                  }
                  className="mt-2 h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {roles.map(
                    (
                      item,
                    ) => (
                      <option
                        key={
                          item
                        }
                        value={
                          item
                        }
                      >
                        {item}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {mutation.isError && (
                <p
                  className="text-sm text-destructive"
                >
                  {mutation.error
                    .message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  mutation.isPending ||
                  !email.trim()
                }
              >
                {mutation.isPending && (
                  <LoaderCircle
                    className="size-4 animate-spin"
                  />
                )}

                Create invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
