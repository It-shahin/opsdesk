'use client';

import {
  AlertCircle,
  Clock3,
  Inbox,
  Mail,
  TicketCheck,
  Users,
} from 'lucide-react';

import {
  useQuery,
} from '@tanstack/react-query';

import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  Button,
} from '@/components/ui/button';

import {
  Skeleton,
} from '@/components/ui/skeleton';

import {
  getAnalyticsOverview,
} from '@/lib/api/analytics.client';

import {
  formatResolutionTime,
} from '@/lib/analytics/format';

import type {
  AnalyticsRange,
} from '@/lib/analytics/types';

import {
  EmailHealth,
} from './email-health';

import {
  MetricCard,
} from './metric-card';

import {
  TeamWorkload,
} from './team-workload';

import {
  TicketBreakdowns,
} from './ticket-breakdowns';

import {
  TicketVolumeChart,
} from './ticket-volume-chart';

const ranges:
  Array<{
    value:
      AnalyticsRange;

    label:
      string;
  }> = [
    {
      value:
        '7d',

      label:
        '7 days',
    },

    {
      value:
        '30d',

      label:
        '30 days',
    },

    {
      value:
        '90d',

      label:
        '90 days',
    },
  ];

export function AnalyticsDashboard({
  organizationId,
}: {
  organizationId:
    string;
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const rangeParam =
    searchParams.get(
      'range',
    );

  const range:
    AnalyticsRange =
    rangeParam ===
      '7d' ||
    rangeParam ===
      '90d'
      ? rangeParam
      : '30d';

  const query =
    useQuery({
      queryKey: [
        'analytics',
        organizationId,
        range,
      ],

      queryFn:
        () =>
          getAnalyticsOverview(
            organizationId,
            range,
          ),

      staleTime:
        30_000,

      /*
       * Analytics doesn't need
       * instant sub-second accuracy,
       * but periodic refresh keeps
       * non-realtime metrics current.
       */
      refetchInterval:
        60_000,
    });

  function setRange(
    next:
      AnalyticsRange,
  ) {
    const params =
      new URLSearchParams(
        searchParams
          .toString(),
      );

    if (
      next ===
      '30d'
    ) {
      params.delete(
        'range',
      );
    } else {
      params.set(
        'range',
        next,
      );
    }

    const queryString =
      params.toString();

    router.replace(
      queryString
        ? `${pathname}?${queryString}`
        : pathname,

      {
        scroll:
          false,
      },
    );
  }

  if (
    query.isLoading
  ) {
    return (
      <AnalyticsSkeleton />
    );
  }

  if (
    query.isError
  ) {
    return (
      <div
        className="rounded-xl border bg-background p-10 text-center"
      >
        <AlertCircle
          className="mx-auto size-8 text-muted-foreground"
        />

        <h2
          className="mt-4 font-medium"
        >
          Could not load analytics
        </h2>

        <p
          className="mt-2 text-sm text-muted-foreground"
        >
          {query.error
            .message}
        </p>

        <Button
          variant="outline"
          className="mt-5"
          onClick={
            () =>
              void query
                .refetch()
          }
        >
          Try again
        </Button>
      </div>
    );
  }

  const analytics =
    query.data;

  if (
    !analytics
  ) {
    return null;
  }

  return (
    <div
      className="space-y-6"
    >
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Analytics range"
      >
        {ranges.map(
          (
            option,
          ) => (
            <Button
              key={
                option.value
              }
              variant={
                range ===
                  option.value
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              onClick={
                () =>
                  setRange(
                    option.value,
                  )
              }
            >
              {option.label}
            </Button>
          ),
        )}
      </div>

      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          title="Active tickets"
          value={
            analytics
              .tickets
              .active
          }
          description={`${analytics.tickets.open} open · ${analytics.tickets.pending} pending`}
          icon={
            Inbox
          }
        />

        <MetricCard
          title="Created"
          value={
            analytics
              .tickets
              .createdInPeriod
          }
          description={`Tickets created in the last ${analytics.range.days} days`}
          icon={
            Mail
          }
        />

        <MetricCard
          title="Resolved"
          value={
            analytics
              .tickets
              .resolvedInPeriod
          }
          description={`Tickets resolved in the last ${analytics.range.days} days`}
          icon={
            TicketCheck
          }
        />

        <MetricCard
          title="Avg. resolution"
          value={
            formatResolutionTime(
              analytics
                .tickets
                .averageResolutionMinutes,
            )
          }
          description="Average time from creation to resolution"
          icon={
            Clock3
          }
        />
      </div>

      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          title="Urgent active"
          value={
            analytics
              .tickets
              .urgentActive
          }
          description="Urgent OPEN or PENDING tickets"
          icon={
            AlertCircle
          }
        />

        <MetricCard
          title="Unassigned"
          value={
            analytics
              .tickets
              .unassignedActive
          }
          description="Active tickets without an assignee"
          icon={
            Inbox
          }
        />

        <MetricCard
          title="Active customers"
          value={
            analytics
              .customers
              .active
          }
          description={`${analytics.customers.createdInPeriod} created in this period`}
          icon={
            Users
          }
        />

        <MetricCard
          title="Delivery rate"
          value={
            analytics
              .email
              .deliveryRatePercent ===
            null
              ? '—'
              : `${analytics.email.deliveryRatePercent}%`
          }
          description={`${analytics.email.totalInPeriod} outbound deliveries in this period`}
          icon={
            Mail
          }
        />
      </div>

      <TicketVolumeChart
        data={
          analytics.ticketVolume
        }
      />

      <TicketBreakdowns
        analytics={
          analytics
        }
      />

      <div
        className="grid gap-4 xl:grid-cols-2"
      >
        <TeamWorkload
          workload={
            analytics.workload
          }
        />

        <EmailHealth
          email={
            analytics.email
          }
        />
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div
      className="space-y-6"
    >
      <Skeleton
        className="h-9 w-64"
      />

      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {Array.from({
          length:
            8,
        }).map(
          (
            _,
            index,
          ) => (
            <Skeleton
              key={
                index
              }
              className="h-32"
            />
          ),
        )}
      </div>

      <Skeleton
        className="h-96"
      />

      <div
        className="grid gap-4 md:grid-cols-3"
      >
        <Skeleton
          className="h-72"
        />

        <Skeleton
          className="h-72"
        />

        <Skeleton
          className="h-72"
        />
      </div>
    </div>
  );
}