'use client';

import {
  useState,
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
    if (
      organizationId ===
      activeId
    ) {
      return;
    }

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
      router.push(
        `/app/${organizationId}`,
      );
    } finally {
      setPendingId(
        null,
      );
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-auto w-full justify-between px-3 py-2"
          />
        }
      >
        <span
          className="min-w-0 text-left"
        >
          <span
            className="block truncate text-sm font-medium"
          >
            {active?.name ??
              'Select workspace'}
          </span>

          {active && (
            <span
              className="block text-xs text-muted-foreground"
            >
              {active.role}
            </span>
          )}
        </span>

        <ChevronsUpDown
          className="size-4 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="min-w-56"
      >
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
                disabled={
                  pendingId !==
                  null
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
                  >
                    {organization.name}
                  </span>

                  <span
                    className="block text-xs text-muted-foreground"
                  >
                    {organization.role}
                  </span>
                </span>

                {pendingId ===
                organization.id ? (
                  <LoaderCircle
                    className="ml-auto size-4 animate-spin"
                  />
                ) : activeId ===
                  organization.id ? (
                  <Check
                    className="ml-auto size-4"
                  />
                ) : null}
              </DropdownMenuItem>
            ),
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}