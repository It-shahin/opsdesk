import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { PrismaService } from '../database/prisma.service.js';
import { AnalyticsService } from './analytics.service.js';

describe('AnalyticsService', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const now = new Date('2028-03-01T14:15:00Z');
  const ticketGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const ticketCount = jest.fn<(args: unknown) => Promise<number>>();
  const customerCount = jest.fn<(args: unknown) => Promise<number>>();
  const emailGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const members = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const queryRaw =
    jest.fn<
      (sql: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>
    >();
  const prisma = {
    ticket: { groupBy: ticketGroupBy, count: ticketCount },
    customer: { count: customerCount },
    emailDelivery: { groupBy: emailGroupBy },
    membership: { findMany: members },
    $queryRaw: queryRaw,
  };
  let service: AnalyticsService;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ now });
    ticketGroupBy.mockResolvedValue([]);
    ticketCount.mockResolvedValue(0);
    customerCount.mockResolvedValue(0);
    emailGroupBy.mockResolvedValue([]);
    members.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]);
    service = new AnalyticsService(prisma as unknown as PrismaService);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    { range: '7d' as const, days: 7, from: '2028-02-24T00:00:00.000Z' },
    { range: '30d' as const, days: 30, from: '2028-02-01T00:00:00.000Z' },
    { range: '90d' as const, days: 90, from: '2027-12-03T00:00:00.000Z' },
  ])(
    'includes the current partial UTC day in the $range window',
    async ({ range, days, from }) => {
      const result = await service.getOverview(organizationId, range);
      expect(result.range).toEqual({
        preset: range,
        timezone: 'UTC',
        from,
        to: now.toISOString(),
        days,
      });
      expect(result.ticketVolume).toHaveLength(days);
      expect(result.ticketVolume[0]).toEqual({
        date: from.slice(0, 10),
        created: 0,
        resolved: 0,
      });
      expect(result.ticketVolume.at(-1)).toEqual({
        date: '2028-03-01',
        created: 0,
        resolved: 0,
      });
      expect(new Set(result.ticketVolume.map((row) => row.date)).size).toBe(
        days,
      );
    },
  );

  it('returns complete zero counts and a null average for an empty organization', async () => {
    const result = await service.getOverview(organizationId, '7d');
    expect(result.tickets).toEqual({
      total: 0,
      active: 0,
      open: 0,
      pending: 0,
      resolved: 0,
      closed: 0,
      urgentActive: 0,
      unassignedActive: 0,
      createdInPeriod: 0,
      resolvedInPeriod: 0,
      averageResolutionMinutes: null,
      byStatus: { OPEN: 0, PENDING: 0, RESOLVED: 0, CLOSED: 0 },
      byPriority: { LOW: 0, NORMAL: 0, HIGH: 0, URGENT: 0 },
      bySource: { MANUAL: 0, EMAIL: 0 },
    });
    expect(result.customers).toEqual({
      total: 0,
      active: 0,
      archived: 0,
      createdInPeriod: 0,
    });
    expect(result.workload).toEqual([]);
    expect(result.email).toEqual({
      totalInPeriod: 0,
      inFlight: 0,
      delivered: 0,
      failed: 0,
      deliveryRatePercent: null,
      failureRatePercent: null,
      byStatus: {
        PENDING: 0,
        SENDING: 0,
        SENT: 0,
        DELAYED: 0,
        DELIVERED: 0,
        BOUNCED: 0,
        COMPLAINED: 0,
        SUPPRESSED: 0,
        FAILED: 0,
      },
    });
  });

  it('fills absent enum groups with zero while summing the available status groups', async () => {
    ticketGroupBy
      .mockResolvedValueOnce([
        { status: 'OPEN', _count: { _all: 5 } },
        { status: 'RESOLVED', _count: { _all: 10 } },
      ])
      .mockResolvedValueOnce([{ priority: 'NORMAL', _count: { _all: 15 } }])
      .mockResolvedValueOnce([{ source: 'MANUAL', _count: { _all: 15 } }])
      .mockResolvedValueOnce([]);
    const result = await service.getOverview(organizationId, '7d');
    expect(result.tickets.open).toBe(5);
    expect(result.tickets.total).toBe(15);
    expect(result.tickets.byStatus).toEqual({
      OPEN: 5,
      PENDING: 0,
      RESOLVED: 10,
      CLOSED: 0,
    });
    expect(result.tickets.byPriority).toEqual({
      LOW: 0,
      NORMAL: 15,
      HIGH: 0,
      URGENT: 0,
    });
    expect(result.tickets.bySource).toEqual({ MANUAL: 15, EMAIL: 0 });
  });

  it('combines snapshot totals, zero-filled daily trends, workload and email health', async () => {
    ticketGroupBy
      .mockResolvedValueOnce([
        { status: 'OPEN', _count: { _all: 4 } },
        { status: 'PENDING', _count: { _all: 2 } },
        { status: 'RESOLVED', _count: { _all: 3 } },
        { status: 'CLOSED', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { priority: 'LOW', _count: { _all: 1 } },
        { priority: 'NORMAL', _count: { _all: 3 } },
        { priority: 'HIGH', _count: { _all: 4 } },
        { priority: 'URGENT', _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { source: 'MANUAL', _count: { _all: 7 } },
        { source: 'EMAIL', _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { assigneeMembershipId: 'owner', status: 'OPEN', _count: { _all: 2 } },
        {
          assigneeMembershipId: 'owner',
          status: 'PENDING',
          _count: { _all: 2 },
        },
        { assigneeMembershipId: 'agent', status: 'OPEN', _count: { _all: 2 } },
      ]);
    ticketCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    customerCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    emailGroupBy.mockResolvedValue(
      Object.entries({
        PENDING: 2,
        SENDING: 1,
        SENT: 3,
        DELAYED: 1,
        DELIVERED: 4,
        BOUNCED: 2,
        COMPLAINED: 1,
        SUPPRESSED: 1,
        FAILED: 3,
      }).map(([status, count]) => ({ status, _count: { _all: count } })),
    );
    const user = {
      id: 'user',
      name: null,
      email: 'user@example.com',
      avatarUrl: null,
    };
    members.mockResolvedValue([
      { id: 'agent', role: 'AGENT', user },
      { id: 'owner', role: 'OWNER', user },
      { id: 'idle', role: 'ADMIN', user },
    ]);
    queryRaw
      .mockResolvedValueOnce([
        { date: '2028-02-26', count: 2 },
        { date: '2028-03-01', count: 1 },
      ])
      .mockResolvedValueOnce([{ date: '2028-02-27', count: 2 }])
      .mockResolvedValueOnce([{ averageMinutes: 90.25 }]);

    const result = await service.getOverview(organizationId, '7d');
    expect(result.tickets).toEqual({
      total: 10,
      active: 6,
      open: 4,
      pending: 2,
      resolved: 3,
      closed: 1,
      urgentActive: 2,
      unassignedActive: 1,
      createdInPeriod: 3,
      resolvedInPeriod: 2,
      averageResolutionMinutes: 90.3,
      byStatus: { OPEN: 4, PENDING: 2, RESOLVED: 3, CLOSED: 1 },
      byPriority: { LOW: 1, NORMAL: 3, HIGH: 4, URGENT: 2 },
      bySource: { MANUAL: 7, EMAIL: 3 },
    });
    expect(result.ticketVolume).toEqual([
      { date: '2028-02-24', created: 0, resolved: 0 },
      { date: '2028-02-25', created: 0, resolved: 0 },
      { date: '2028-02-26', created: 2, resolved: 0 },
      { date: '2028-02-27', created: 0, resolved: 2 },
      { date: '2028-02-28', created: 0, resolved: 0 },
      { date: '2028-02-29', created: 0, resolved: 0 },
      { date: '2028-03-01', created: 1, resolved: 0 },
    ]);
    expect(result.customers).toEqual({
      total: 5,
      active: 3,
      archived: 2,
      createdInPeriod: 2,
    });
    expect(result.workload).toEqual([
      {
        membershipId: 'owner',
        role: 'OWNER',
        user,
        openTickets: 2,
        pendingTickets: 2,
        activeTickets: 4,
      },
      {
        membershipId: 'agent',
        role: 'AGENT',
        user,
        openTickets: 2,
        pendingTickets: 0,
        activeTickets: 2,
      },
      {
        membershipId: 'idle',
        role: 'ADMIN',
        user,
        openTickets: 0,
        pendingTickets: 0,
        activeTickets: 0,
      },
    ]);
    expect(result.email).toMatchObject({
      totalInPeriod: 18,
      inFlight: 7,
      delivered: 4,
      failed: 7,
      deliveryRatePercent: 36.36,
      failureRatePercent: 63.64,
    });
  });

  it('preserves member order for equal workloads and includes idle members', async () => {
    const user = {
      id: 'user',
      name: null,
      email: 'user@example.com',
      avatarUrl: null,
    };
    members.mockResolvedValue([
      { id: 'z-idle', role: 'ADMIN', user },
      { id: 'z-busy', role: 'OWNER', user },
      { id: 'a-busy', role: 'AGENT', user },
      { id: 'a-idle', role: 'AGENT', user },
    ]);
    ticketGroupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { assigneeMembershipId: 'z-busy', status: 'OPEN', _count: { _all: 2 } },
        {
          assigneeMembershipId: 'a-busy',
          status: 'PENDING',
          _count: { _all: 2 },
        },
      ]);
    const result = await service.getOverview(organizationId, '7d');
    expect(
      result.workload.map(({ membershipId, activeTickets }) => ({
        membershipId,
        activeTickets,
      })),
    ).toEqual([
      { membershipId: 'z-busy', activeTickets: 2 },
      { membershipId: 'a-busy', activeTickets: 2 },
      { membershipId: 'z-idle', activeTickets: 0 },
      { membershipId: 'a-idle', activeTickets: 0 },
    ]);
  });

  it.each([
    {
      delivered: 0,
      failed: 0,
      deliveryRatePercent: null,
      failureRatePercent: null,
    },
    {
      delivered: 3,
      failed: 0,
      deliveryRatePercent: 100,
      failureRatePercent: 0,
    },
    {
      delivered: 0,
      failed: 3,
      deliveryRatePercent: 0,
      failureRatePercent: 100,
    },
    {
      delivered: 2,
      failed: 1,
      deliveryRatePercent: 66.67,
      failureRatePercent: 33.33,
    },
  ])(
    'calculates terminal-only rates for $delivered delivered and $failed failed',
    async ({ delivered, failed, deliveryRatePercent, failureRatePercent }) => {
      emailGroupBy.mockResolvedValue([
        { status: 'DELIVERED', _count: { _all: delivered } },
        { status: 'FAILED', _count: { _all: failed } },
        { status: 'PENDING', _count: { _all: 5 } },
        { status: 'SENDING', _count: { _all: 3 } },
        { status: 'SENT', _count: { _all: 2 } },
        { status: 'DELAYED', _count: { _all: 1 } },
      ]);
      const result = await service.getOverview(organizationId, '7d');
      expect(result.email).toMatchObject({
        totalInPeriod: delivered + failed + 11,
        delivered,
        failed,
        inFlight: 11,
        deliveryRatePercent,
        failureRatePercent,
      });
    },
  );

  it('reports 80% delivered and 20% failed while three SENT deliveries remain in flight', async () => {
    emailGroupBy.mockResolvedValue([
      { status: 'DELIVERED', _count: { _all: 8 } },
      { status: 'BOUNCED', _count: { _all: 1 } },
      { status: 'FAILED', _count: { _all: 1 } },
      { status: 'SENT', _count: { _all: 3 } },
    ]);
    const result = await service.getOverview(organizationId, '7d');
    expect(result.email).toMatchObject({
      totalInPeriod: 13,
      delivered: 8,
      failed: 2,
      inFlight: 3,
      deliveryRatePercent: 80,
      failureRatePercent: 20,
    });
  });

  it('scopes every query to the organization and parameterizes raw SQL bounds', async () => {
    const result = await service.getOverview(organizationId, '30d');
    for (const mock of [
      ticketGroupBy,
      ticketCount,
      customerCount,
      emailGroupBy,
      members,
    ]) {
      for (const [args] of mock.mock.calls) {
        expect(args).toEqual(
          expect.objectContaining({
            where: expect.objectContaining({ organizationId }),
          }),
        );
      }
    }
    expect(members).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId, role: { not: 'VIEWER' } },
      }),
    );
    expect(ticketCount).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId,
        priority: 'URGENT',
        status: { in: ['OPEN', 'PENDING'] },
      },
    });
    expect(ticketCount).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId,
        assigneeMembershipId: null,
        status: { in: ['OPEN', 'PENDING'] },
      },
    });
    const createdAt = { gte: new Date(result.range.from), lte: now };
    expect(customerCount).toHaveBeenNthCalledWith(3, {
      where: { organizationId, createdAt },
    });
    expect(emailGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId, createdAt } }),
    );
    expect(queryRaw).toHaveBeenCalledTimes(3);
    for (const [sql, ...values] of queryRaw.mock.calls) {
      expect(sql.join('?')).not.toContain(organizationId);
      expect(sql.join('?')).toContain('"organizationId" = ?::uuid');
      expect(values).toEqual([
        organizationId,
        new Date(result.range.from),
        now,
      ]);
    }
  });

  it.each([null, 0])(
    'preserves an average of %s without substituting another value',
    async (averageMinutes) => {
      queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ averageMinutes }]);
      expect(
        (await service.getOverview(organizationId, '7d')).tickets
          .averageResolutionMinutes,
      ).toBe(averageMinutes);
    },
  );

  it('propagates database failures instead of returning misleading zero metrics', async () => {
    const error = new Error('Database query failed');
    queryRaw.mockRejectedValueOnce(error);
    await expect(service.getOverview(organizationId, '7d')).rejects.toBe(error);
  });
});
