import {
  Badge,
} from '@/components/ui/badge';

import type {
  TicketPriority,
  TicketStatus,
} from '@/lib/tickets/types';

export function TicketStatusBadge({
  status,
}: {
  status:
    TicketStatus;
}) {
  const className =
    {
      OPEN:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',

      PENDING:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',

      RESOLVED:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',

      CLOSED:
        'border-border bg-muted text-muted-foreground',
    }[
      status
    ];

  return (
    <Badge
      variant="outline"
      className={
        className
      }
    >
      {status}
    </Badge>
  );
}

export function TicketPriorityBadge({
  priority,
}: {
  priority:
    TicketPriority;
}) {
  const className =
    {
      LOW:
        'text-muted-foreground',

      NORMAL:
        '',

      HIGH:
        'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300',

      URGENT:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
    }[
      priority
    ];

  return (
    <Badge
      variant="outline"
      className={
        className
      }
    >
      {priority}
    </Badge>
  );
}