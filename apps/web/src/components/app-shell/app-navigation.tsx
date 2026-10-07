'use client';

import Link from 'next/link';

import {
  ContactRound,
  Inbox,
  Users,
} from 'lucide-react';

import {
  usePathname,
} from 'next/navigation';

import {
  cn,
} from '@/lib/utils';

export function AppNavigation({
  organizationId,
  onNavigate,
}: {
  organizationId:
    string | undefined;

  onNavigate?:
    () => void;
}) {
  const pathname =
    usePathname();

  const items =
    organizationId
      ? [
          {
            label:
              'Inbox',

            href:
              `/app/${organizationId}`,

            icon:
              Inbox,

            active:
              pathname ===
                `/app/${organizationId}` ||
              pathname.includes(
                '/tickets/',
              ),
          },

          {
            label:
              'Customers',

            href:
              `/app/${organizationId}/customers`,

            icon:
              ContactRound,

            active:
              pathname.includes(
                '/customers',
              ),
          },

          {
            label:
              'Team',

            href:
              `/app/${organizationId}/team`,

            icon:
              Users,

            active:
              pathname.includes(
                '/team',
              ),
          },
        ]
      : [];

  if (
    !organizationId
  ) {
    return null;
  }

  return (
    <nav
      aria-label="Workspace navigation"
      className="space-y-1"
    >
      {items.map(
        (
          item,
        ) => {
          const Icon =
            item.icon;

          return (
            <Link
              key={
                item.href
              }
              href={
                item.href
              }
              onClick={
                onNavigate
              }
              aria-current={
                item.active
                  ? 'page'
                  : undefined
              }
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',

                item.active
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon
                className="size-4"
              />

              {item.label}
            </Link>
          );
        },
      )}
    </nav>
  );
}
