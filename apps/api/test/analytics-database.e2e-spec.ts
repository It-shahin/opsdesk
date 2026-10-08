import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

import { AnalyticsService } from '../src/analytics/analytics.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Opt in with pnpm --filter api test:analytics:db. Fixtures use a temporary schema.
const databaseDescribe =
  process.env.ANALYTICS_DATABASE_TESTS === '1' ? describe : describe.skip;

databaseDescribe('Analytics aggregates in PostgreSQL', () => {
  const schema = `analytics_test_${randomUUID().replaceAll('-', '')}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const emptyOrg = randomUUID();
  const emailOrg = randomUUID();
  const customerA = randomUUID();
  const customerB = randomUUID();
  const owner = randomUUID();
  const agent = randomUUID();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dateAt = (daysAgo: number, minutes = 0) =>
    new Date(today.getTime() - daysAgo * 86_400_000 + minutes * 60_000);
  let admin: Client;
  let prisma: PrismaClient;
  let service: AnalyticsService;
  let schemaCreated = false;

  beforeAll(async () => {
    config({ path: '.env', quiet: true });
    const connectionString =
      process.env.ANALYTICS_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString)
      throw new Error(
        'Set ANALYTICS_TEST_DATABASE_URL or DATABASE_URL to run database tests',
      );
    admin = new Client({ connectionString, connectionTimeoutMillis: 5000 });
    await admin.connect();
    await admin.query('BEGIN');
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.query(`SET LOCAL search_path TO "${schema}"`);
      const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
      const migrations = (await readdir(migrationsDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const migration of migrations) {
        const sql = await readFile(
          join(migrationsDir, migration, 'migration.sql'),
          'utf8',
        );
        if (/\bpublic\s*\.|"public"\s*\./i.test(sql))
          throw new Error(
            'Database tests require migrations scoped by search_path',
          );
        await admin.query(sql);
      }
      await admin.query('COMMIT');
      schemaCreated = true;
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString,
          // Raw SQL also needs the isolated search_path. A non-UTC session catches
          // accidental timezone conversion of Prisma's UTC timestamp columns.
          options: `-c search_path=${schema} -c timezone=Pacific/Honolulu`,
        },
        { schema },
      ),
    });
    service = new AnalyticsService(prisma as PrismaService);
    await prisma.organization.createMany({
      data: [orgA, orgB, emptyOrg, emailOrg].map((id) => ({
        id,
        name: id,
        slug: id,
      })),
    });
    const users = [randomUUID(), randomUUID(), randomUUID()];
    await prisma.user.createMany({
      data: users.map((id) => ({
        id,
        authProviderId: id,
        email: `${id}@example.com`,
      })),
    });
    await prisma.membership.createMany({
      data: [
        { id: owner, organizationId: orgA, userId: users[0], role: 'OWNER' },
        { id: agent, organizationId: orgA, userId: users[1], role: 'AGENT' },
        { organizationId: orgA, userId: users[2], role: 'VIEWER' },
      ],
    });
    await prisma.customer.createMany({
      data: [
        {
          id: customerA,
          organizationId: orgA,
          name: 'Active',
          createdAt: today,
        },
        {
          organizationId: orgA,
          name: 'Archived',
          archivedAt: today,
          createdAt: dateAt(10),
        },
        {
          id: customerB,
          organizationId: orgB,
          name: 'Other tenant',
          createdAt: today,
        },
      ],
    });
    const ticketA = randomUUID();
    const ticketB = randomUUID();
    await prisma.ticket.createMany({
      data: [
        {
          id: ticketA,
          organizationId: orgA,
          customerId: customerA,
          subject: 'Active',
          status: 'OPEN',
          priority: 'HIGH',
          source: 'EMAIL',
          assigneeMembershipId: owner,
          createdAt: dateAt(1, 1439),
        },
        {
          organizationId: orgA,
          customerId: customerA,
          subject: 'Immediate resolution',
          status: 'RESOLVED',
          createdAt: today,
          resolvedAt: today,
        },
        {
          organizationId: orgA,
          customerId: customerA,
          subject: 'Crosses midnight',
          status: 'RESOLVED',
          priority: 'LOW',
          createdAt: dateAt(1, 1350),
          resolvedAt: today,
        },
        {
          organizationId: orgA,
          customerId: customerA,
          subject: 'Older creation, recent resolution',
          status: 'RESOLVED',
          createdAt: dateAt(8),
          resolvedAt: today,
        },
        {
          organizationId: orgA,
          customerId: customerA,
          subject: 'Old closed',
          status: 'CLOSED',
          createdAt: dateAt(10),
          resolvedAt: dateAt(9),
          closedAt: dateAt(9),
        },
        {
          organizationId: orgA,
          customerId: customerA,
          subject: 'Start boundary',
          status: 'PENDING',
          priority: 'URGENT',
          createdAt: dateAt(6),
        },
        {
          organizationId: orgA,
          customerId: customerA,
          subject: 'Before boundary',
          status: 'CLOSED',
          createdAt: new Date(dateAt(6).getTime() - 1),
        },
        {
          organizationId: orgA,
          customerId: customerA,
          subject: 'Future timestamp',
          status: 'CLOSED',
          createdAt: dateAt(-1),
          resolvedAt: dateAt(-1),
        },
        {
          id: ticketB,
          organizationId: orgB,
          customerId: customerB,
          subject: 'Other tenant',
          status: 'PENDING',
          priority: 'URGENT',
          createdAt: today,
          resolvedAt: today,
        },
      ],
    });
    for (const delivery of [
      {
        organizationId: orgA,
        ticketId: ticketA,
        status: 'DELIVERED' as const,
        createdAt: today,
      },
      {
        organizationId: orgA,
        ticketId: ticketA,
        status: 'PENDING' as const,
        createdAt: today,
      },
      {
        organizationId: orgA,
        ticketId: ticketA,
        status: 'FAILED' as const,
        createdAt: dateAt(9),
      },
      {
        organizationId: orgB,
        ticketId: ticketB,
        status: 'BOUNCED' as const,
        createdAt: today,
      },
    ]) {
      const message = await prisma.ticketMessage.create({
        data: {
          organizationId: delivery.organizationId,
          ticketId: delivery.ticketId,
          kind: 'PUBLIC_REPLY',
          authorType: 'SYSTEM',
          source: 'SYSTEM',
          body: 'Fixture',
        },
      });
      await prisma.emailDelivery.create({
        data: { ...delivery, messageId: message.id },
      });
    }

    const emailCustomer = await prisma.customer.create({
      data: { organizationId: emailOrg, name: 'Email metrics fixture' },
    });
    const emailTicket = await prisma.ticket.create({
      data: {
        organizationId: emailOrg,
        customerId: emailCustomer.id,
        subject: 'Email metrics fixture',
      },
    });
    const statuses = [
      ...Array.from({ length: 8 }, () => 'DELIVERED' as const),
      'BOUNCED',
      'FAILED',
      ...Array.from({ length: 3 }, () => 'SENT' as const),
    ] as const;
    const messageIds = statuses.map(() => randomUUID());
    await prisma.ticketMessage.createMany({
      data: messageIds.map((id) => ({
        id,
        organizationId: emailOrg,
        ticketId: emailTicket.id,
        kind: 'PUBLIC_REPLY',
        authorType: 'SYSTEM',
        source: 'SYSTEM',
        body: 'Fixture',
      })),
    });
    await prisma.emailDelivery.createMany({
      data: statuses.map((status, index) => ({
        organizationId: emailOrg,
        ticketId: emailTicket.id,
        messageId: messageIds[index],
        status,
        createdAt: today,
      })),
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma?.$disconnect();
    } finally {
      try {
        if (schemaCreated) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin?.end();
      }
    }
  });

  it('keeps UTC dates, inclusive range bounds and aggregates isolated from another tenant', async () => {
    expect(await prisma.$queryRaw`SHOW TIMEZONE`).toEqual([
      { TimeZone: 'Pacific/Honolulu' },
    ]);
    const result = await service.getOverview(orgA, '7d');
    expect(result.tickets).toMatchObject({
      total: 8,
      active: 2,
      open: 1,
      pending: 1,
      resolved: 3,
      closed: 3,
      urgentActive: 1,
      unassignedActive: 1,
      createdInPeriod: 4,
      resolvedInPeriod: 3,
      averageResolutionMinutes: 3870,
      byPriority: { LOW: 1, NORMAL: 5, HIGH: 1, URGENT: 1 },
      bySource: { MANUAL: 7, EMAIL: 1 },
    });
    expect(result.ticketVolume).toHaveLength(7);
    expect(result.ticketVolume[0]).toEqual({
      date: dateAt(6).toISOString().slice(0, 10),
      created: 1,
      resolved: 0,
    });
    expect(
      result.ticketVolume
        .slice(1, -2)
        .every((day) => day.created === 0 && day.resolved === 0),
    ).toBe(true);
    expect(result.ticketVolume.slice(-2)).toEqual([
      { date: dateAt(1).toISOString().slice(0, 10), created: 2, resolved: 0 },
      { date: today.toISOString().slice(0, 10), created: 1, resolved: 3 },
    ]);
    expect(result.customers).toEqual({
      total: 2,
      active: 1,
      archived: 1,
      createdInPeriod: 1,
    });
    expect(result.workload).toMatchObject([
      {
        membershipId: owner,
        role: 'OWNER',
        openTickets: 1,
        pendingTickets: 0,
        activeTickets: 1,
      },
      {
        membershipId: agent,
        role: 'AGENT',
        openTickets: 0,
        pendingTickets: 0,
        activeTickets: 0,
      },
    ]);
    expect(result.email).toMatchObject({
      totalInPeriod: 2,
      inFlight: 1,
      delivered: 1,
      failed: 0,
      deliveryRatePercent: 100,
      failureRatePercent: 0,
      byStatus: { FAILED: 0, BOUNCED: 0 },
    });
  });

  it.each(['7d', '30d', '90d'] as const)(
    'returns zero-filled %s metrics for an empty tenant even when other tenants have records',
    async (range) => {
      const result = await service.getOverview(emptyOrg, range);
      expect(result.tickets).toMatchObject({
        total: 0,
        active: 0,
        createdInPeriod: 0,
        resolvedInPeriod: 0,
        averageResolutionMinutes: null,
      });
      expect(result.ticketVolume).toHaveLength(Number.parseInt(range, 10));
      expect(
        result.ticketVolume.every(
          (day) => day.created === 0 && day.resolved === 0,
        ),
      ).toBe(true);
      expect(result.customers).toEqual({
        total: 0,
        active: 0,
        archived: 0,
        createdInPeriod: 0,
      });
      expect(result.workload).toEqual([]);
      expect(result.email).toMatchObject({
        totalInPeriod: 0,
        inFlight: 0,
        delivered: 0,
        failed: 0,
        deliveryRatePercent: null,
        failureRatePercent: null,
      });
    },
  );

  it('aggregates real deliveries using terminal outcomes as the percentage denominator', async () => {
    const result = await service.getOverview(emailOrg, '7d');
    expect(result.email).toEqual({
      totalInPeriod: 13,
      delivered: 8,
      failed: 2,
      inFlight: 3,
      deliveryRatePercent: 80,
      failureRatePercent: 20,
      byStatus: {
        PENDING: 0,
        SENDING: 0,
        SENT: 3,
        DELAYED: 0,
        DELIVERED: 8,
        BOUNCED: 1,
        COMPLAINED: 0,
        SUPPRESSED: 0,
        FAILED: 1,
      },
    });
  });
});
