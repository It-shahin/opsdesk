'use client';

import Link from 'next/link';

import {
  ContactRound,
  Inbox,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';

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

import type {
  CurrentUser,
} from '@/lib/api/current-user';

import {
  usePathname,
} from 'next/navigation';

import {
  WorkspaceSwitcher,
} from '@/components/organizations/workspace-switcher';

import {
  CreateOrganizationDialog,
} from '@/components/organizations/create-organization-dialog';

import type {
  Organization,
} from '@/lib/organizations/types';

function getInitials(
  user:
    CurrentUser,
) {
  if (
    user.name
  ) {
    return user.name
      .split(' ')
      .slice(
        0,
        2,
      )
      .map(
        (
          part,
        ) =>
          part[0],
      )
      .join('')
      .toUpperCase();
  }

  return user.email
    .slice(
      0,
      2,
    )
    .toUpperCase();
}

export function AppShell({
  user,
  organizations,
  children,
}: Readonly<{
  user:
    CurrentUser;

  organizations:
    Organization[];

  children:
    React.ReactNode;
}>) {
    const pathname =
    usePathname();

    const pathParts =
    pathname
        .split('/')
        .filter(Boolean);

    const organizationId =
    pathParts[0] ===
        'app'
        ? pathParts[1]
        : undefined;

    const inboxHref =
    organizationId
        ? `/app/${organizationId}`
        : '/app';

  return (
    <div
      className="min-h-screen bg-muted/20"
    >
      <div
        className="flex min-h-screen"
      >
        <aside
          className="hidden w-64 shrink-0 border-r bg-background lg:flex lg:flex-col"
        >
          <div
            className="flex h-16 items-center gap-3 border-b px-5"
          >
            <div
              className="flex size-9 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background"
            >
              OD
            </div>

            <div>
              <p
                className="font-semibold"
              >
                OpsDesk
              </p>

              <p
                className="text-xs text-muted-foreground"
              >
                Support workspace
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2 border-b p-3"
          >
            <div
              className="min-w-0 flex-1"
            >
              <WorkspaceSwitcher
                organizations={
                  organizations
                }
              />
            </div>

            <CreateOrganizationDialog
              iconOnly
            />
          </div>

          <nav
            className="flex-1 space-y-1 p-3"
          >
            <Link
                href={
                    inboxHref
                }
                className="flex items-center gap-3 rounded-md bg-accent px-3 py-2 text-sm font-medium"
                >
                <Inbox
                    className="size-4"
                />

                Inbox
            </Link>

            <div
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground"
            >
              <ContactRound
                className="size-4"
              />

              Customers
            </div>

            <div
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground"
            >
              <Users
                className="size-4"
              />

              Team
            </div>

            <div
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground"
            >
              <Settings
                className="size-4"
              />

              Settings
            </div>
          </nav>

          <div
            className="border-t p-4 text-xs text-muted-foreground"
          >
            OpsDesk
          </div>
        </aside>

        <div
          className="flex min-w-0 flex-1 flex-col"
        >
          <header
            className="flex h-16 items-center justify-end gap-3 border-b bg-background px-4 sm:px-6"
          >
            <div
              className="flex min-w-0 flex-1 items-center gap-2 lg:hidden"
            >
              <div
                className="min-w-0 flex-1"
              >
                <WorkspaceSwitcher
                  organizations={
                    organizations
                  }
                />
              </div>

              <CreateOrganizationDialog
                iconOnly
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="h-auto gap-3 px-2 py-1.5"
                  />
                }
              >
                <Avatar
                  className="size-8"
                >
                  {user.avatarUrl && (
                    <AvatarImage
                      src={
                        user.avatarUrl
                      }
                      alt={
                        user.name ??
                        user.email
                      }
                    />
                  )}

                  <AvatarFallback>
                    {getInitials(
                      user,
                    )}
                  </AvatarFallback>
                </Avatar>

                <span
                  className="hidden text-left sm:block"
                >
                  <span
                    className="block max-w-40 truncate text-sm font-medium"
                  >
                    {user.name ??
                      user.email}
                  </span>

                  <span
                    className="block max-w-40 truncate text-xs text-muted-foreground"
                  >
                    {user.email}
                  </span>
                </span>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    My account
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    render={
                      <a
                        href="/auth/logout"
                      />
                    }
                    className="cursor-pointer"
                  >
                    <LogOut
                      className="size-4"
                    />

                    Log out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main
            className="flex-1 p-4 sm:p-6 lg:p-8"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
