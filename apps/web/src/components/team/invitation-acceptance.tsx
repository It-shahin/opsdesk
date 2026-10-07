'use client';

import {
  useMutation,
} from '@tanstack/react-query';

import {
  CheckCircle2,
  LoaderCircle,
  LogOut,
  Users,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';

import {
  acceptInvitation,
} from '@/lib/api/team.client';

import {
  setActiveOrganizationPreference,
} from '@/lib/api/organizations.client';

export function InvitationAcceptance({
  token,
}: {
  token:
    string;
}) {
  const mutation =
    useMutation({
      mutationFn:
        () =>
          acceptInvitation(
            token,
          ),

      onSuccess:
        async (
          result,
        ) => {
          await setActiveOrganizationPreference(
            result.organization
              .id,
          );

          /*
           * Full navigation ensures
           * the AppShell reloads its
           * organization memberships.
           */
          window.location.assign(
            `/app/${result.organization.id}`,
          );
        },
    });

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-muted/20 px-6"
    >
      <div
        className="w-full max-w-md rounded-xl border bg-background p-8 text-center"
      >
        <div
          className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted"
        >
          {mutation.isSuccess ? (
            <CheckCircle2
              className="size-6"
            />
          ) : (
            <Users
              className="size-6"
            />
          )}
        </div>

        <h1
          className="mt-5 text-xl font-semibold"
        >
          Join workspace
        </h1>

        <p
          className="mt-2 text-sm text-muted-foreground"
        >
          Accept this invitation using
          the account matching the
          invited email address.
        </p>

        {mutation.isError && (
          <div
            className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
          >
            <p
              className="text-sm text-destructive"
            >
              {mutation.error
                .message}
            </p>

            {mutation.error
              .message
              .includes(
                'does not belong',
              ) && (
              <a
                href="/auth/logout"
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium underline"
              >
                <LogOut
                  className="size-4"
                />

                Sign in with another account
              </a>
            )}
          </div>
        )}

        <Button
          className="mt-6 w-full"
          disabled={
            mutation.isPending ||
            mutation.isSuccess
          }
          onClick={
            () =>
              mutation.mutate()
          }
        >
          {mutation.isPending && (
            <LoaderCircle
              className="size-4 animate-spin"
            />
          )}

          Accept invitation
        </Button>
      </div>
    </main>
  );
}