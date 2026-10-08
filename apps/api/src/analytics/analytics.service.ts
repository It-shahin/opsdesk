import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

import type {
  EmailDeliveryStatus,
  Role,
  TicketPriority,
  TicketSource,
  TicketStatus,
} from '../generated/prisma/enums.js';

import type { AnalyticsRange } from './dto/analytics-overview-query.dto.js';

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  '7d': 7,

  '30d': 30,

  '90d': 90,
};

type TrendRow = {
  date: string;

  count: number;
};

type ResolutionAverageRow = {
  averageMinutes: number | null;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    organizationId: string,

    range: AnalyticsRange,
  ) {
    const { from, to, days } = this.getWindow(range);

    const [
      statusGroups,
      priorityGroups,
      sourceGroups,

      urgentActive,
      unassignedActive,

      customerTotal,
      customerActive,
      customersCreated,

      emailGroups,

      members,
      workloadGroups,

      createdTrend,
      resolvedTrend,
      resolutionAverage,
    ] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['status'],

        where: {
          organizationId,
        },

        _count: {
          _all: true,
        },
      }),

      this.prisma.ticket.groupBy({
        by: ['priority'],

        where: {
          organizationId,
        },

        _count: {
          _all: true,
        },
      }),

      this.prisma.ticket.groupBy({
        by: ['source'],

        where: {
          organizationId,
        },

        _count: {
          _all: true,
        },
      }),

      this.prisma.ticket.count({
        where: {
          organizationId,

          priority: 'URGENT',

          status: {
            in: ['OPEN', 'PENDING'],
          },
        },
      }),

      this.prisma.ticket.count({
        where: {
          organizationId,

          assigneeMembershipId: null,

          status: {
            in: ['OPEN', 'PENDING'],
          },
        },
      }),

      this.prisma.customer.count({
        where: {
          organizationId,
        },
      }),

      this.prisma.customer.count({
        where: {
          organizationId,

          archivedAt: null,
        },
      }),

      this.prisma.customer.count({
        where: {
          organizationId,

          createdAt: {
            gte: from,

            lte: to,
          },
        },
      }),

      this.prisma.emailDelivery.groupBy({
        by: ['status'],

        where: {
          organizationId,

          createdAt: {
            gte: from,

            lte: to,
          },
        },

        _count: {
          _all: true,
        },
      }),

      this.prisma.membership.findMany({
        where: {
          organizationId,

          role: {
            not: 'VIEWER',
          },
        },

        select: {
          id: true,

          role: true,

          user: {
            select: {
              id: true,

              name: true,

              email: true,

              avatarUrl: true,
            },
          },
        },

        orderBy: {
          createdAt: 'asc',
        },
      }),

      this.prisma.ticket.groupBy({
        by: ['assigneeMembershipId', 'status'],

        where: {
          organizationId,

          assigneeMembershipId: {
            not: null,
          },

          status: {
            in: ['OPEN', 'PENDING'],
          },
        },

        _count: {
          _all: true,
        },
      }),

      this.getCreatedTrend(organizationId, from, to),

      this.getResolvedTrend(organizationId, from, to),

      this.getAverageResolutionTime(organizationId, from, to),
    ]);

    const byStatus: Record<TicketStatus, number> = {
      OPEN: 0,

      PENDING: 0,

      RESOLVED: 0,

      CLOSED: 0,
    };

    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all;
    }

    const byPriority: Record<TicketPriority, number> = {
      LOW: 0,

      NORMAL: 0,

      HIGH: 0,

      URGENT: 0,
    };

    for (const group of priorityGroups) {
      byPriority[group.priority] = group._count._all;
    }

    const bySource: Record<TicketSource, number> = {
      MANUAL: 0,

      EMAIL: 0,
    };

    for (const group of sourceGroups) {
      bySource[group.source] = group._count._all;
    }

    const emailByStatus: Record<EmailDeliveryStatus, number> = {
      PENDING: 0,

      SENDING: 0,

      SENT: 0,

      DELAYED: 0,

      DELIVERED: 0,

      BOUNCED: 0,

      COMPLAINED: 0,

      SUPPRESSED: 0,

      FAILED: 0,
    };

    for (const group of emailGroups) {
      emailByStatus[group.status] = group._count._all;
    }

    const volume = this.buildDailyVolume(
      from,
      days,
      createdTrend,
      resolvedTrend,
    );

    const ticketsCreatedInPeriod = createdTrend.reduce(
      (total, row) => total + Number(row.count),
      0,
    );

    const ticketsResolvedInPeriod = resolvedTrend.reduce(
      (total, row) => total + Number(row.count),
      0,
    );

    const workload = this.buildWorkload(members, workloadGroups);

    const email = this.buildEmailHealth(emailByStatus);

    const totalTickets = Object.values(byStatus).reduce(
      (total, count) => total + count,
      0,
    );

    return {
      range: {
        preset: range,

        timezone: 'UTC',

        from: from.toISOString(),

        to: to.toISOString(),

        days,
      },

      tickets: {
        total: totalTickets,

        active: byStatus.OPEN + byStatus.PENDING,

        open: byStatus.OPEN,

        pending: byStatus.PENDING,

        resolved: byStatus.RESOLVED,

        closed: byStatus.CLOSED,

        urgentActive,

        unassignedActive,

        createdInPeriod: ticketsCreatedInPeriod,

        resolvedInPeriod: ticketsResolvedInPeriod,

        averageResolutionMinutes:
          resolutionAverage[0]?.averageMinutes === null ||
          resolutionAverage[0]?.averageMinutes === undefined
            ? null
            : Math.round(resolutionAverage[0].averageMinutes * 10) / 10,

        byStatus,

        byPriority,

        bySource,
      },

      ticketVolume: volume,

      customers: {
        total: customerTotal,

        active: customerActive,

        archived: customerTotal - customerActive,

        createdInPeriod: customersCreated,
      },

      workload,

      email,
    };
  }

  private getWindow(range: AnalyticsRange) {
    const days = RANGE_DAYS[range];
    const to = new Date();
    const from = new Date(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
    );

    from.setUTCDate(from.getUTCDate() - (days - 1));
    return { from, to, days };
  }

  private getCreatedTrend(organizationId: string, from: Date, to: Date) {
    // Prisma stores these UTC instants as timestamp without time zone. A direct
    // date cast preserves their UTC day even when the session uses another zone.
    return this.prisma.$queryRaw<TrendRow[]>`
      SELECT
        to_char("createdAt"::date, 'YYYY-MM-DD') AS "date",
        COUNT(*)::int AS "count"
      FROM "tickets"
      WHERE "organizationId" = ${organizationId}::uuid
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }

  private getResolvedTrend(organizationId: string, from: Date, to: Date) {
    return this.prisma.$queryRaw<TrendRow[]>`
      SELECT
        to_char("resolvedAt"::date, 'YYYY-MM-DD') AS "date",
        COUNT(*)::int AS "count"
      FROM "tickets"
      WHERE "organizationId" = ${organizationId}::uuid
        AND "resolvedAt" IS NOT NULL
        AND "resolvedAt" >= ${from}
        AND "resolvedAt" <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }

  private getAverageResolutionTime(
    organizationId: string,
    from: Date,
    to: Date,
  ) {
    return this.prisma.$queryRaw<ResolutionAverageRow[]>`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 60.0)
          ::double precision AS "averageMinutes"
      FROM "tickets"
      WHERE "organizationId" = ${organizationId}::uuid
        AND "resolvedAt" IS NOT NULL
        AND "resolvedAt" >= ${from}
        AND "resolvedAt" <= ${to}
    `;
  }

  private buildDailyVolume(
    from: Date,
    days: number,
    createdTrend: TrendRow[],
    resolvedTrend: TrendRow[],
  ) {
    const created = new Map(
      createdTrend.map((row) => [row.date, Number(row.count)]),
    );
    const resolved = new Map(
      resolvedTrend.map((row) => [row.date, Number(row.count)]),
    );

    return Array.from({ length: days }, (_, index) => {
      const day = new Date(from);
      day.setUTCDate(day.getUTCDate() + index);
      const date = day.toISOString().slice(0, 10);
      return {
        date,
        created: created.get(date) ?? 0,
        resolved: resolved.get(date) ?? 0,
      };
    });
  }

  private buildWorkload(
    members: Array<{
      id: string;
      role: Role;
      user: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
      };
    }>,
    groups: Array<{
      assigneeMembershipId: string | null;
      status: TicketStatus;
      _count: { _all: number };
    }>,
  ) {
    const counts = new Map<string, { open: number; pending: number }>();
    for (const group of groups) {
      if (!group.assigneeMembershipId) continue;
      const workload = counts.get(group.assigneeMembershipId) ?? {
        open: 0,
        pending: 0,
      };
      if (group.status === 'OPEN') workload.open = group._count._all;
      if (group.status === 'PENDING') workload.pending = group._count._all;
      counts.set(group.assigneeMembershipId, workload);
    }

    return members
      .map((member) => {
        const { open, pending } = counts.get(member.id) ?? {
          open: 0,
          pending: 0,
        };
        return {
          membershipId: member.id,
          role: member.role,
          user: member.user,
          openTickets: open,
          pendingTickets: pending,
          activeTickets: open + pending,
        };
      })
      .sort((first, second) => second.activeTickets - first.activeTickets);
  }

  private buildEmailHealth(byStatus: Record<EmailDeliveryStatus, number>) {
    const failed =
      byStatus.BOUNCED +
      byStatus.COMPLAINED +
      byStatus.SUPPRESSED +
      byStatus.FAILED;
    const inFlight =
      byStatus.PENDING + byStatus.SENDING + byStatus.SENT + byStatus.DELAYED;
    const terminal = byStatus.DELIVERED + failed;
    const total = Object.values(byStatus).reduce(
      (sum, count) => sum + count,
      0,
    );

    // In-flight deliveries are unfinished and do not affect either rate.
    const deliveryRatePercent =
      terminal === 0
        ? null
        : Math.round((byStatus.DELIVERED / terminal) * 10_000) / 100;
    const failureRatePercent =
      terminal === 0 ? null : Math.round((failed / terminal) * 10_000) / 100;

    return {
      totalInPeriod: total,
      delivered: byStatus.DELIVERED,
      failed,
      inFlight,
      deliveryRatePercent,
      failureRatePercent,
      byStatus,
    };
  }
}
