import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import {
  DEMO_MARKER_ID,
  DEMO_MEMBERSHIP_ID,
  DEMO_ORGANIZATION_ID,
  demoId,
} from '../src/demo/demo-data.js';
import {
  assertSafeDemoTarget,
  DEMO_NAME,
  DEMO_SLUG,
  type DemoOptions,
} from '../src/demo/demo-options.js';
import { UsersService } from '../src/users/users.service.js';
import type { Auth0UserInfoService } from '../src/auth/auth0-userinfo.service.js';
import { MembershipsService } from '../src/memberships/memberships.service.js';
import { TenantContextService } from '../src/tenancy/tenant-context.service.js';
import { TenantMembershipGuard } from '../src/tenancy/tenant-membership.guard.js';
import type { TenantAuthenticatedRequest } from '../src/tenancy/tenant-context.types.js';
import { AnalyticsService } from '../src/analytics/analytics.service.js';

// Fail immediately if a future seed imports providers that could cause side effects.
const forbiddenIntegration = jest.fn(() => {
  throw new Error('Seed imported an outbound integration');
});
for (const dependency of [
  'bullmq',
  'resend',
  '@aws-sdk/client-s3',
  '@nestjs/core',
])
  jest.unstable_mockModule(dependency, forbiddenIntegration);
const { runDemo } = await import('../src/demo/demo-seed.js');

const databaseDescribe =
  process.env.DEMO_DATABASE_TESTS === '1' ? describe : describe.skip;

databaseDescribe('Demo seed in isolated PostgreSQL', () => {
  const schema = `demo_test_${randomUUID().replaceAll('-', '')}`;
  let admin: Client;
  let prisma: PrismaClient;
  let createdSchema = false;
  let env: NodeJS.ProcessEnv;
  let ownerId: string;
  let outsiderId: string;
  let users: UsersService;
  let guard: TenantMembershipGuard;
  const otherOrgId = randomUUID();
  const otherCustomerId = randomUUID();
  const otherTicketId = randomUUID();
  const asOf = new Date();
  let originalAccount: unknown;
  let originalTenant: unknown;
  let firstSnapshot: unknown;

  const options = (override: Partial<DemoOptions> = {}): DemoOptions => ({
    action: 'seed',
    target: 'local',
    owner: { id: ownerId },
    asOf,
    confirmSeed: true,
    ...override,
  });
  const snapshot = async () => ({
    organizations: await prisma.organization.findMany({
      orderBy: { id: 'asc' },
    }),
    memberships: await prisma.membership.findMany({ orderBy: { id: 'asc' } }),
    customers: await prisma.customer.findMany({ orderBy: { id: 'asc' } }),
    tickets: await prisma.ticket.findMany({ orderBy: { id: 'asc' } }),
    tags: await prisma.tag.findMany({ orderBy: { id: 'asc' } }),
    messages: await prisma.ticketMessage.findMany({ orderBy: { id: 'asc' } }),
    links: await prisma.ticketTag.findMany({
      orderBy: [{ ticketId: 'asc' }, { tagId: 'asc' }],
    }),
    audits: await prisma.auditLog.findMany({ orderBy: { id: 'asc' } }),
  });
  const requestContext = (subject: string) => {
    const request = {
      params: { organizationId: DEMO_ORGANIZATION_ID },
      auth: { sub: subject },
      accessToken: 'isolated-test-token-not-a-credential',
    } as unknown as TenantAuthenticatedRequest;
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as ExecutionContext,
    };
  };

  beforeAll(async () => {
    // Never load .env or fall back to the operational DATABASE_URL.
    const connectionString = process.env.DEMO_TEST_DATABASE_URL;
    env = { NODE_ENV: 'test', DATABASE_URL: connectionString };
    assertSafeDemoTarget(options(), env);
    const db = decodeURIComponent(new URL(connectionString!).pathname.slice(1));
    if (!/(?:^|_)test(?:_|$)|(?:^|_)ci(?:_|$)/.test(db))
      throw new Error(
        'DEMO_TEST_DATABASE_URL must identify a local disposable test/ci database',
      );
    admin = new Client({ connectionString, connectionTimeoutMillis: 5000 });
    await admin.connect();
    await admin.query('BEGIN');
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.query(`SET LOCAL search_path TO "${schema}"`);
      const directory = join(process.cwd(), 'prisma', 'migrations');
      const migrations = (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const migration of migrations) {
        const sql = await readFile(
          join(directory, migration, 'migration.sql'),
          'utf8',
        );
        if (/\bpublic\s*\.|"public"\s*\./i.test(sql))
          throw new Error('Migrations must respect the isolated search_path');
        await admin.query(sql);
      }
      await admin.query('COMMIT');
      createdSchema = true;
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString,
          options: `-c search_path=${schema}`,
          connectionTimeoutMillis: 5000,
        },
        { schema },
      ),
    });
    // The genuine synchronization service creates fixture accounts ONLY in this
    // temporary schema. Mock subjects/tokens cannot sign in to any Auth0 tenant.
    const profiles = {
      'auth0|isolated-demo-owner': {
        sub: 'auth0|isolated-demo-owner',
        email: 'owner@example.com',
        emailVerified: true,
        name: 'Test Owner',
      },
      'auth0|isolated-demo-outsider': {
        sub: 'auth0|isolated-demo-outsider',
        email: 'outsider@example.com',
        emailVerified: true,
        name: 'Test Outsider',
      },
    };
    const profileService = {
      getUserProfile: async (_token: string, subject: keyof typeof profiles) =>
        profiles[subject],
    };
    users = new UsersService(
      prisma as PrismaService,
      profileService as unknown as Auth0UserInfoService,
    );
    ownerId = (
      await users.syncAuthenticatedUser({
        auth: { sub: 'auth0|isolated-demo-owner' },
        accessToken: 'fixture',
      })
    ).id;
    outsiderId = (
      await users.syncAuthenticatedUser({
        auth: { sub: 'auth0|isolated-demo-outsider' },
        accessToken: 'fixture',
      })
    ).id;
    const memberships = new MembershipsService(prisma as PrismaService);
    guard = new TenantMembershipGuard(
      users,
      new TenantContextService(memberships),
    );
    await prisma.organization.create({
      data: {
        id: otherOrgId,
        name: 'Existing tenant fixture',
        slug: 'existing-tenant-fixture',
      },
    });
    await prisma.membership.create({
      data: { userId: ownerId, organizationId: otherOrgId, role: 'AGENT' },
    });
    await prisma.customer.create({
      data: {
        id: otherCustomerId,
        organizationId: otherOrgId,
        name: 'Existing customer fixture',
      },
    });
    await prisma.ticket.create({
      data: {
        id: otherTicketId,
        organizationId: otherOrgId,
        customerId: otherCustomerId,
        subject: 'Existing tenant work',
      },
    });
    originalAccount = await prisma.user.findUnique({ where: { id: ownerId } });
    originalTenant = await snapshot();
  }, 30_000);

  afterAll(async () => {
    try {
      await prisma?.$disconnect();
    } finally {
      try {
        if (createdSchema) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin?.end();
      }
    }
  });

  it('rejects a missing or unsynchronized owner without writing anything', async () => {
    await expect(
      runDemo(
        prisma,
        options({ owner: { email: 'missing@example.com' } }),
        env,
      ),
    ).rejects.toThrow('existing Auth0');
    const user = await prisma.user.create({
      data: {
        authProviderId: 'not-auth0',
        email: 'unsynchronized@example.com',
      },
    });
    await expect(
      runDemo(prisma, options({ owner: { id: user.id } }), env),
    ).rejects.toThrow('existing Auth0');
    await prisma.user.delete({ where: { id: user.id } });
    expect(await snapshot()).toEqual(originalTenant);
  });

  it('rolls back the whole transaction on an ID collision in another tenant', async () => {
    const id = demoId('customer:0');
    await prisma.customer.create({
      data: { id, organizationId: otherOrgId, name: 'Collision fixture' },
    });
    await expect(runDemo(prisma, options(), env)).rejects.toThrow();
    expect(
      await prisma.organization.findUnique({
        where: { id: DEMO_ORGANIZATION_ID },
      }),
    ).toBeNull();
    expect(await prisma.customer.findUnique({ where: { id } })).toMatchObject({
      organizationId: otherOrgId,
    });
    await prisma.customer.delete({ where: { id } });
    expect(await snapshot()).toEqual(originalTenant);
  });

  it('creates the first seed with the expected records and reuses the owner unchanged', async () => {
    expect(
      await runDemo(
        prisma,
        options({ owner: { email: 'owner@example.com' } }),
        env,
      ),
    ).toMatchObject({
      outcome: 'created',
      customers: 8,
      tickets: 12,
      tags: 5,
      messages: 48,
      ticketTags: 13,
      auditEvents: 35,
    });
    expect(await prisma.user.findUnique({ where: { id: ownerId } })).toEqual(
      originalAccount,
    );
    expect(await prisma.user.count()).toBe(2);
    expect(
      await prisma.membership.findUnique({ where: { id: DEMO_MEMBERSHIP_ID } }),
    ).toMatchObject({
      userId: ownerId,
      role: 'OWNER',
      organizationId: DEMO_ORGANIZATION_ID,
    });
    firstSnapshot = await snapshot();
  });

  it('leaves all timestamps and records unchanged on a second run', async () => {
    expect(
      await runDemo(
        prisma,
        options({
          asOf: undefined,
          owner: { authProviderId: 'auth0|isolated-demo-owner' },
        }),
        env,
      ),
    ).toMatchObject({ outcome: 'unchanged' });
    expect(await snapshot()).toEqual(firstSnapshot);
    await expect(
      runDemo(prisma, options({ asOf: new Date('2026-01-01') }), env),
    ).rejects.toThrow('different --as-of');
    await expect(
      runDemo(prisma, options({ owner: { id: outsiderId } }), env),
    ).rejects.toThrow('owner mismatch');
    expect(await snapshot()).toEqual(firstSnapshot);
  });

  it('allows the synchronized owner through the actual tenant guard', async () => {
    const { request, context } = requestContext('auth0|isolated-demo-owner');
    expect(await guard.canActivate(context)).toBe(true);
    expect(request.tenant).toMatchObject({
      userId: ownerId,
      organizationId: DEMO_ORGANIZATION_ID,
      membershipId: DEMO_MEMBERSHIP_ID,
      role: 'OWNER',
    });
  });

  it('denies a synchronized outsider access to the demo tenant', async () => {
    const { context } = requestContext('auth0|isolated-demo-outsider');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(
      await prisma.membership.count({
        where: { userId: outsiderId, organizationId: DEMO_ORGANIZATION_ID },
      }),
    ).toBe(0);
  });

  it('keeps every child and related record in the demo organization', async () => {
    expect(
      await runDemo(
        prisma,
        options({ action: 'validate', asOf: undefined, confirmSeed: false }),
        env,
      ),
    ).toMatchObject({ outcome: 'validated' });
    const tickets = await prisma.ticket.findMany({
      where: { organizationId: DEMO_ORGANIZATION_ID },
      include: {
        customer: true,
        assignee: true,
        tagLinks: { include: { tag: true } },
        messages: { include: { authorMembership: true } },
      },
    });
    expect(tickets).toHaveLength(12);
    expect(
      tickets.every(
        (ticket) =>
          ticket.customer.organizationId === DEMO_ORGANIZATION_ID &&
          (!ticket.assignee ||
            ticket.assignee.organizationId === DEMO_ORGANIZATION_ID) &&
          ticket.tagLinks.every(
            (link) => link.tag.organizationId === DEMO_ORGANIZATION_ID,
          ) &&
          ticket.messages.every(
            (message) =>
              message.organizationId === DEMO_ORGANIZATION_ID &&
              (!message.authorMembership ||
                message.authorMembership.organizationId ===
                  DEMO_ORGANIZATION_ID),
          ),
      ),
    ).toBe(true);
    const analytics = await new AnalyticsService(
      prisma as PrismaService,
    ).getOverview(DEMO_ORGANIZATION_ID, '30d');
    expect(analytics.tickets).toMatchObject({
      total: 12,
      open: 3,
      pending: 3,
      resolved: 3,
      closed: 3,
      unassignedActive: 2,
    });
    expect(analytics.tickets.averageResolutionMinutes).toBeGreaterThan(0);
    expect(
      analytics.ticketVolume.filter((day) => day.created > 0).length,
    ).toBeGreaterThan(5);
  });

  it('rejects unsafe production execution before opening a transaction', async () => {
    const spy = jest.spyOn(prisma, '$transaction');
    await expect(
      runDemo(prisma, options(), { ...env, NODE_ENV: 'production' }),
    ).rejects.toThrow('Local target');
    await expect(
      runDemo(prisma, options(), { ...env, APP_ENV: 'production' }),
    ).rejects.toThrow('Production');
    await expect(
      runDemo(prisma, options({ confirmSeed: false }), env),
    ).rejects.toThrow('confirm-demo-seed');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('never imports outbound providers, enqueues email or creates side-effect records', async () => {
    await runDemo(prisma, options({ asOf: undefined }), env);
    expect(forbiddenIntegration).not.toHaveBeenCalled();
    expect(await prisma.emailDelivery.count()).toBe(0);
    expect(await prisma.webhookEvent.count()).toBe(0);
    expect(await prisma.attachment.count()).toBe(0);
    expect(await prisma.invitation.count()).toBe(0);
  });

  it('preserves interactive edits and aborts instead of repairing incomplete seeds', async () => {
    const id = demoId('ticket:0');
    await prisma.ticket.update({
      where: { id },
      data: { subject: 'Edited during a demo' },
    });
    await runDemo(prisma, options({ asOf: undefined }), env);
    expect(await prisma.ticket.findUnique({ where: { id } })).toMatchObject({
      subject: 'Edited during a demo',
    });
    const messageId = demoId('message:0:0');
    const message = await prisma.ticketMessage.findUniqueOrThrow({
      where: { id: messageId },
    });
    await prisma.ticketMessage.delete({ where: { id: messageId } });
    await expect(
      runDemo(prisma, options({ asOf: undefined }), env),
    ).rejects.toThrow('Incomplete');
    expect(await prisma.ticketMessage.count({ where: { id: messageId } })).toBe(
      0,
    );
    await prisma.ticketMessage.create({ data: message });
  });

  it('refuses reset when interactive records or external references exist', async () => {
    const reset = options({
      action: 'reset',
      asOf: undefined,
      confirmReset: DEMO_SLUG,
    });
    const extra = await prisma.customer.create({
      data: {
        organizationId: DEMO_ORGANIZATION_ID,
        name: 'Extra synthetic demo customer',
      },
    });
    await expect(runDemo(prisma, reset, env)).rejects.toThrow(
      'additional records',
    );
    await prisma.customer.delete({ where: { id: extra.id } });
    const existingTicket = await prisma.ticket.findUniqueOrThrow({
      where: { id: otherTicketId },
    });
    await prisma.ticket.update({
      where: { id: otherTicketId },
      data: { assigneeMembershipId: DEMO_MEMBERSHIP_ID },
    });
    await expect(runDemo(prisma, reset, env)).rejects.toThrow(
      'external references',
    );
    await prisma.ticket.update({
      where: { id: otherTicketId },
      data: { assigneeMembershipId: null, updatedAt: existingTicket.updatedAt },
    });
  });

  it('resets only verified demo data and leaves existing users and tenants intact', async () => {
    const reset = options({
      action: 'reset',
      asOf: undefined,
      confirmReset: DEMO_SLUG,
    });
    expect(await runDemo(prisma, reset, env)).toMatchObject({
      outcome: 'reset',
    });
    expect(await runDemo(prisma, reset, env)).toMatchObject({
      outcome: 'absent',
    });
    expect(await snapshot()).toEqual(originalTenant);
    expect(await prisma.user.count()).toBe(2);
    expect(await runDemo(prisma, options(), env)).toMatchObject({
      outcome: 'created',
    });
  });

  it('never adopts an unmarked organization even if its name, slug and ID match', async () => {
    const marker = await prisma.auditLog.findUniqueOrThrow({
      where: { id: DEMO_MARKER_ID },
    });
    await prisma.auditLog.delete({ where: { id: DEMO_MARKER_ID } });
    await expect(runDemo(prisma, options(), env)).rejects.toThrow('provenance');
    await expect(
      runDemo(
        prisma,
        options({ action: 'reset', asOf: undefined, confirmReset: DEMO_SLUG }),
        env,
      ),
    ).rejects.toThrow('provenance');
    await prisma.auditLog.create({
      data: {
        ...marker,
        metadata: marker.metadata as { [key: string]: string },
      },
    });
    await runDemo(
      prisma,
      options({ action: 'reset', asOf: undefined, confirmReset: DEMO_SLUG }),
      env,
    );
    await prisma.organization.create({
      data: { name: DEMO_NAME, slug: DEMO_SLUG },
    });
    await expect(runDemo(prisma, options(), env)).rejects.toThrow(
      'identity collision',
    );
  });
});
