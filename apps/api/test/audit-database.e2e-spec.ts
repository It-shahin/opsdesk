import type { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { config } from 'dotenv';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

import { AuditService } from '../src/audit/audit.service.js';
import { CustomersService } from '../src/customers/customers.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { InboundEmailProviderService } from '../src/email/inbound-email-provider.service.js';
import { InboundEmailService } from '../src/email/inbound-email.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { InvitationsService } from '../src/invitations/invitations.service.js';
import type { JobsService } from '../src/jobs/jobs.service.js';
import { MembersService } from '../src/members/members.service.js';
import type { MembershipsService } from '../src/memberships/memberships.service.js';
import { OrganizationsService } from '../src/organizations/organizations.service.js';
import type { RealtimeService } from '../src/realtime/realtime.service.js';
import { TagsService } from '../src/tags/tags.service.js';
import type { TenantContext } from '../src/tenancy/tenant-context.types.js';
import { TicketsService } from '../src/tickets/tickets.service.js';

// Run with pnpm --filter api test:audit:db. An optional AUDIT_TEST_DATABASE_URL
// overrides DATABASE_URL from .env. All tables live in a new schema, removed on exit.
const databaseDescribe =
  process.env.AUDIT_DATABASE_TESTS === '1' ? describe : describe.skip;

databaseDescribe('Audit persistence in PostgreSQL', () => {
  const schema = `audit_test_${randomUUID().replaceAll('-', '')}`;
  let admin: Client;
  let prisma: PrismaClient;
  let schemaCreated = false;
  let audit: AuditService;
  let customers: CustomersService;
  let tickets: TicketsService;
  let tags: TagsService;
  let members: MembersService;
  let invitations: InvitationsService;
  let organizations: OrganizationsService;
  let inbound: InboundEmailService;
  const tenant: TenantContext = {
    organizationId: randomUUID(),
    userId: randomUUID(),
    membershipId: randomUUID(),
    role: 'OWNER',
  };
  const orgB = randomUUID();
  const customerId = randomUUID();
  const ticketId = randomUUID();
  const targetUserId = randomUUID();
  const targetMembershipId = randomUUID();
  const invitationId = randomUUID();
  const invitedUser = { id: randomUUID(), email: 'invited@example.com' };
  const acceptanceToken = 'private-invitation-token-for-the-database-fixture';
  const realtime = {
    publishTicketCreated: jest.fn<RealtimeService['publishTicketCreated']>(),
    publishTicketUpdated: jest.fn<RealtimeService['publishTicketUpdated']>(),
    publishMessageCreated: jest.fn<RealtimeService['publishMessageCreated']>(),
    publishEmailDeliveryUpdated:
      jest.fn<RealtimeService['publishEmailDeliveryUpdated']>(),
  };
  const jobs = {
    ensureEmailDeliveryQueued:
      jest.fn<JobsService['ensureEmailDeliveryQueued']>(),
  };
  const provider = {
    getReceivedEmail:
      jest.fn<InboundEmailProviderService['getReceivedEmail']>(),
  };

  const receiveReply = () =>
    inbound.handleReceivedEmail(
      {
        emailId: 'email-1',
        from: 'customer@example.com',
        to: [`ticket-${ticketId}@inbound.example.com`],
      },
      {
        eventType: 'email.received',
        providerEntityId: 'email-1',
        webhookMessageId: 'webhook-1',
      },
    );

  beforeAll(async () => {
    config({ path: '.env', quiet: true });
    const connectionString =
      process.env.AUDIT_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString)
      throw new Error(
        'Set AUDIT_TEST_DATABASE_URL or DATABASE_URL to run database tests',
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
        if (/\bpublic\s*\.|"public"\s*\./i.test(sql)) {
          throw new Error(
            'Database tests require migrations scoped by search_path',
          );
        }
        await admin.query(sql);
      }
      await admin.query('COMMIT');
      schemaCreated = true;
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }, { schema }),
    });
    const db = prisma as PrismaService;
    audit = new AuditService(db);
    customers = new CustomersService(db, audit);
    tickets = new TicketsService(
      db,
      jobs as unknown as JobsService,
      realtime as unknown as RealtimeService,
      audit,
    );
    tags = new TagsService(db, audit);
    members = new MembersService(db, audit);
    invitations = new InvitationsService(db, audit);
    organizations = new OrganizationsService(
      db,
      {} as MembershipsService,
      audit,
    );
    inbound = new InboundEmailService(
      db,
      provider as unknown as InboundEmailProviderService,
      realtime as unknown as RealtimeService,
      { getOrThrow: () => 'inbound.example.com' } as unknown as ConfigService,
      audit,
    );
  }, 30000);

  beforeEach(async () => {
    jest.resetAllMocks();
    // These three roots cascade only to tables created inside this test schema.
    await admin.query(
      `TRUNCATE "${schema}"."organizations", "${schema}"."users", "${schema}"."webhook_events" CASCADE`,
    );
    await prisma.user.createMany({
      data: [
        {
          id: tenant.userId,
          authProviderId: 'owner',
          email: 'owner@example.com',
        },
        {
          id: targetUserId,
          authProviderId: 'agent',
          email: 'agent@example.com',
        },
        { ...invitedUser, authProviderId: 'invited' },
      ],
    });
    await prisma.organization.createMany({
      data: [
        { id: tenant.organizationId, name: 'Org A', slug: 'org-a' },
        { id: orgB, name: 'Org B', slug: 'org-b' },
      ],
    });
    await prisma.membership.createMany({
      data: [
        {
          id: tenant.membershipId,
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          role: 'OWNER',
        },
        {
          id: targetMembershipId,
          organizationId: tenant.organizationId,
          userId: targetUserId,
          role: 'AGENT',
        },
      ],
    });
    await prisma.customer.create({
      data: {
        id: customerId,
        organizationId: tenant.organizationId,
        name: 'Customer',
        email: 'customer@example.com',
      },
    });
    await prisma.ticket.create({
      data: {
        id: ticketId,
        organizationId: tenant.organizationId,
        customerId,
        subject: 'Private subject',
        description: 'Private description',
        status: 'RESOLVED',
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    await prisma.invitation.create({
      data: {
        id: invitationId,
        organizationId: tenant.organizationId,
        email: invitedUser.email,
        role: 'AGENT',
        tokenHash: createHash('sha256').update(acceptanceToken).digest('hex'),
        invitedByUserId: tenant.userId,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    provider.getReceivedEmail.mockResolvedValue({
      object: 'email',
      id: 'email-1',
      created_at: '2026-10-08T12:00:00Z',
      subject: 'Private customer subject',
      bcc: null,
      cc: null,
      reply_to: null,
      received_for: [`ticket-${ticketId}@inbound.example.com`],
      headers: null,
      message_id: 'message-id-1',
      attachments: [],
      from: 'customer@example.com',
      to: [`ticket-${ticketId}@inbound.example.com`],
      text: 'Private customer reply',
      html: null,
    });
  });

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

  async function rejectInserts(
    table: 'audit_logs' | 'email_deliveries',
    run: () => Promise<void>,
  ) {
    await admin.query(
      `ALTER TABLE "${schema}"."${table}" ADD CONSTRAINT "reject_test_insert" CHECK (false)`,
    );
    try {
      await run();
    } finally {
      await admin.query(
        `ALTER TABLE "${schema}"."${table}" DROP CONSTRAINT "reject_test_insert"`,
      );
    }
  }

  async function snapshot() {
    return {
      organizations: await prisma.organization.findMany({
        orderBy: { id: 'asc' },
      }),
      customers: await prisma.customer.findMany({ orderBy: { id: 'asc' } }),
      tickets: await prisma.ticket.findMany({ orderBy: { id: 'asc' } }),
      memberships: await prisma.membership.findMany({ orderBy: { id: 'asc' } }),
      invitations: await prisma.invitation.findMany({ orderBy: { id: 'asc' } }),
      tags: await prisma.tag.count(),
      messages: await prisma.ticketMessage.count(),
      deliveries: await prisma.emailDelivery.count(),
      events: await prisma.webhookEvent.count(),
      audits: await prisma.auditLog.count(),
    };
  }

  function expectNoPublication() {
    for (const publish of Object.values(realtime))
      expect(publish).not.toHaveBeenCalled();
    expect(jobs.ensureEmailDeliveryQueued).not.toHaveBeenCalled();
  }

  it('commits a customer and its audit together as a positive control', async () => {
    const customer = await customers.create(tenant, { name: 'New customer' });
    expect(
      await prisma.customer.findUnique({ where: { id: customer.id } }),
    ).not.toBeNull();
    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'CUSTOMER_CREATED',
      entityId: customer.id,
      actorUserId: tenant.userId,
    });
  });

  it('rolls back an already inserted audit when a later business insert fails', async () => {
    const before = await snapshot();
    await rejectInserts('email_deliveries', async () => {
      await expect(
        tickets.createMessage(tenant, ticketId, {
          kind: 'PUBLIC_REPLY',
          body: 'Private message body',
        }),
      ).rejects.toThrow();
    });
    expect(await snapshot()).toEqual(before);
    expectNoPublication();
  });

  it.each([
    {
      mutation: 'organization creation',
      run: () => organizations.createForUser(tenant.userId, 'New org'),
    },
    {
      mutation: 'customer creation',
      run: () => customers.create(tenant, { name: 'New customer' }),
    },
    {
      mutation: 'customer archive',
      run: () => customers.archive(tenant, customerId),
    },
    {
      mutation: 'ticket creation',
      run: () => tickets.create(tenant, { customerId, subject: 'New ticket' }),
    },
    {
      mutation: 'ticket status',
      run: () => tickets.updateStatus(tenant, ticketId, 'OPEN'),
    },
    {
      mutation: 'ticket message',
      run: () =>
        tickets.createMessage(tenant, ticketId, {
          kind: 'PUBLIC_REPLY',
          body: 'Private reply',
        }),
    },
    { mutation: 'tag creation', run: () => tags.create(tenant, 'New tag') },
    {
      mutation: 'member role',
      run: () => members.updateRole(tenant, targetMembershipId, 'VIEWER'),
    },
    {
      mutation: 'invitation creation',
      run: () => invitations.create(tenant, 'new@example.com', 'AGENT'),
    },
    {
      mutation: 'invitation cancellation',
      run: () => invitations.cancel(tenant, invitationId),
    },
    {
      mutation: 'invitation acceptance',
      run: () => invitations.accept(invitedUser, acceptanceToken),
    },
    { mutation: 'inbound reply', run: receiveReply },
  ])(
    'rolls back $mutation when PostgreSQL rejects the audit insertion',
    async ({ run }) => {
      const before = await snapshot();
      await rejectInserts('audit_logs', async () => {
        await expect(run()).rejects.toThrow();
      });
      expect(await snapshot()).toEqual(before);
      expectNoPublication();
    },
  );

  it('persists exactly one status event and no event for a rejected repeat', async () => {
    await tickets.updateStatus(tenant, ticketId, 'OPEN');
    await expect(
      tickets.updateStatus(tenant, ticketId, 'OPEN'),
    ).rejects.toThrow();
    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'TICKET_STATUS_CHANGED',
      metadata: { from: 'RESOLVED', to: 'OPEN' },
    });
  });

  it('persists customer archive once for repeated archive requests', async () => {
    await customers.archive(tenant, customerId);
    await customers.archive(tenant, customerId);
    expect(
      await prisma.auditLog.count({ where: { action: 'CUSTOMER_ARCHIVED' } }),
    ).toBe(1);
    expect(
      (await prisma.customer.findUniqueOrThrow({ where: { id: customerId } }))
        .archivedAt,
    ).not.toBeNull();
  });

  it('omits unchanged ticket edits and assignments from the audit history', async () => {
    await tickets.update(tenant, ticketId, {
      subject: 'Private subject',
      description: 'Private description',
      priority: 'NORMAL',
    });
    await tickets.assign(tenant, ticketId, null);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('keeps invitation tokens and hashes out of persisted metadata', async () => {
    const invitation = await invitations.create(
      tenant,
      'new@example.com',
      'AGENT',
    );
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: invitation.id },
    });
    expect(log.metadata).toEqual({ role: 'AGENT' });
    expect(JSON.stringify(log)).not.toContain(invitation.acceptanceToken);
    expect(JSON.stringify(log)).not.toContain(
      createHash('sha256').update(invitation.acceptanceToken).digest('hex'),
    );
  });

  it('keeps message bodies and recipient emails out of persisted metadata', async () => {
    const message = await tickets.createMessage(tenant, ticketId, {
      kind: 'PUBLIC_REPLY',
      body: 'Private message body',
    });
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: message.id },
    });
    expect(log.metadata).toEqual({
      ticketId,
      kind: 'PUBLIC_REPLY',
      source: 'MANUAL',
      attachmentCount: 0,
    });
    expect(JSON.stringify(log)).not.toContain('Private message body');
    expect(JSON.stringify(log)).not.toContain('customer@example.com');
  });

  it('persists member role transitions with IDs and from/to roles', async () => {
    await members.updateRole(tenant, targetMembershipId, 'VIEWER');
    const log = await prisma.auditLog.findFirstOrThrow();
    expect(log.metadata).toEqual({
      targetUserId,
      fromRole: 'AGENT',
      toRole: 'VIEWER',
    });
  });

  it('stores null actor IDs for an inbound reply and its ticket reopen event', async () => {
    await receiveReply();
    await receiveReply();
    const logs = await prisma.auditLog.findMany({ orderBy: { action: 'asc' } });
    expect(logs).toHaveLength(2);
    for (const log of logs) {
      expect(log.actorUserId).toBeNull();
      expect(log.actorMembershipId).toBeNull();
      expect(log.actorRole).toBeNull();
    }
    expect(
      logs.find((log) => log.action === 'TICKET_MESSAGE_CREATED')?.metadata,
    ).toEqual({
      ticketId,
      kind: 'PUBLIC_REPLY',
      source: 'EMAIL',
      authorType: 'CUSTOMER',
    });
    expect(
      logs.find((log) => log.action === 'TICKET_STATUS_CHANGED')?.metadata,
    ).toEqual({ to: 'OPEN', reason: 'CUSTOMER_REPLY' });
  });

  it('filters and paginates real rows with tenant scope and stable timestamp ties', async () => {
    const ids = [1, 2, 3].map(
      (id) => `00000000-0000-4000-8000-00000000000${id}`,
    );
    const data = {
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      action: 'TICKET_STATUS_CHANGED' as const,
      entityType: 'TICKET' as const,
      entityId: ticketId,
      createdAt: new Date('2026-10-08T12:00:00Z'),
    };
    await prisma.auditLog.createMany({
      data: [
        ...ids.map((id) => ({ ...data, id })),
        { ...data, id: randomUUID(), organizationId: orgB },
        { ...data, id: randomUUID(), action: 'TICKET_CREATED' },
        { ...data, id: randomUUID(), actorUserId: targetUserId },
        { ...data, id: randomUUID(), entityId: randomUUID() },
        { ...data, id: randomUUID(), entityType: 'CUSTOMER' },
        {
          ...data,
          id: randomUUID(),
          createdAt: new Date('2026-10-09T00:00:00Z'),
        },
      ],
    });
    const filters = {
      limit: 2,
      action: 'TICKET_STATUS_CHANGED' as const,
      entityType: 'TICKET' as const,
      entityId: ticketId,
      actorUserId: tenant.userId,
      from: '2026-10-08T00:00:00Z',
      to: '2026-10-08T23:59:59Z',
    };
    const first = await audit.list(tenant.organizationId, {
      ...filters,
      page: 1,
    });
    const second = await audit.list(tenant.organizationId, {
      ...filters,
      page: 2,
    });
    expect(first.data.map((log) => log.id)).toEqual([ids[2], ids[1]]);
    expect(second.data.map((log) => log.id)).toEqual([ids[0]]);
    expect(first.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(second.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
    for (const log of [...first.data, ...second.data])
      expect(log.organizationId).toBe(tenant.organizationId);
  });
});
