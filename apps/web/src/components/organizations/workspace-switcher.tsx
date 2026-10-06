'use client';

import {
  useState,
  useTransition,
} from 'react';

import {
  Check,
  ChevronsUpDown,
  LoaderCircle,
} from 'lucide-react';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  Button,
} from '@/components/ui/button';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  setActiveOrganizationPreference,
} from '@/lib/api/organizations.client';

import type {
  Organization,
} from '@/lib/organizations/types';

function getOrganizationId(
  pathname:
    string,
) {
  const parts =
    pathname
      .split('/')
      .filter(
        Boolean,
      );

  if (
    parts[0] !==
      'app'
  ) {
    return null;
  }

  return (
    parts[1] ??
    null
  );
}

export function WorkspaceSwitcher({
  organizations,
}: {
  organizations:
    Organization[];
}) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [open, setOpen] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [isNavigating, startTransition] =
    useTransition();

  const [
    pendingId,
    setPendingId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const isPending =
    pendingId !== null ||
    isNavigating;

  const activeId =
    getOrganizationId(
      pathname,
    );

  const active =
    organizations.find(
      (
        organization,
      ) =>
        organization.id ===
        activeId,
    );

  async function selectOrganization(
    organizationId:
      string,
  ) {
    if (isPending) {
      return;
    }

    if (
      organizationId ===
      activeId
    ) {
      setOpen(false);
      return;
    }

    setError(null);
    setPendingId(
      organizationId,
    );

    try {
      await setActiveOrganizationPreference(
        organizationId,
      );

      /*
       * Intentionally reset to
       * the new workspace root.
       *
       * We don't preserve a ticket
       * detail ID from another tenant.
       */
      setOpen(false);
      startTransition(() => {
        router.push(
          `/app/${organizationId}`,
        );
      });
    } catch {
      setError(
        'Could not switch workspaces. Please try again.',
      );
    } finally {
      setPendingId(
        null,
      );
    }
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
    >
      <DropdownMenuTrigger
        disabled={isPending}
        aria-busy={isPending}
        aria-label={
          active
            ? `Switch workspace, current workspace: ${active.name}`
            : 'Select workspace'
        }
        render={
          <Button
            variant="outline"
            className="h-auto w-full justify-between px-3 py-2"
          />
        }
      >
        <span
          className="min-w-0 flex-1 text-left"
        >
          <span
            className="block truncate text-sm font-medium"
            title={active?.name}
          >
            {active?.name ??
              'Select workspace'}
          </span>

          {active && (
            <span
              className="block text-xs capitalize text-muted-foreground"
            >
              {active.role.toLowerCase()}
            </span>
          )}
        </span>

        {isPending ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin text-muted-foreground"
          />
        ) : (
          <ChevronsUpDown
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-64 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            Workspaces
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {organizations.length ===
          0 ? (
            <div
              className="px-2 py-3 text-sm text-muted-foreground"
            >
              No workspaces yet.
            </div>
          ) : (
            organizations.map(
              (
                organization,
              ) => (
                <DropdownMenuItem
                  key={
                    organization.id
                  }
                  disabled={isPending}
                  closeOnClick={false}
                  label={organization.name}
                  aria-current={
                    activeId === organization.id
                      ? 'true'
                      : undefined
                  }
                  onClick={
                    () =>
                      void selectOrganization(
                        organization.id,
                      )
                  }
                >
                  <span
                    className="min-w-0 flex-1"
                  >
                    <span
                      className="block truncate"
                      title={organization.name}
                    >
                      {organization.name}
                    </span>

                    <span
                      className="block text-xs capitalize text-muted-foreground"
                    >
                      {organization.role.toLowerCase()}
                    </span>
                  </span>

                  {pendingId ===
                  organization.id ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="ml-auto size-4 animate-spin"
                    />
                  ) : activeId ===
                    organization.id ? (
                    <Check
                      aria-hidden="true"
                      className="ml-auto size-4"
                    />
                  ) : null}
                </DropdownMenuItem>
              ),
            )
          )}
        </DropdownMenuGroup>

        {error && (
          <p
            role="alert"
            className="px-2 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
