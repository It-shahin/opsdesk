import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import {
  buildDemoData,
  DEMO_MARKER_ID,
  DEMO_MEMBERSHIP_ID,
  DEMO_ORGANIZATION_ID,
  DEMO_VERSION,
} from './demo-data.js';
import {
  assertSafeDemoTarget,
  DEMO_NAME,
  DEMO_SLUG,
  type DemoOptions,
} from './demo-options.js';

type Transaction = Prisma.TransactionClient;
type Dataset = ReturnType<typeof buildDemoData>;

async function resolveOwner(tx: Transaction, options: DemoOptions) {
  const owner = await tx.user.findUnique({ where: options.owner });
  if (!owner || !/^[^|\s]+\|[^\s]+$/.test(owner.authProviderId))
    throw new Error(
      'Owner must be an existing Auth0-synchronized user; sign in to the selected environment first',
    );
  return owner;
}

async function readDemo(
  tx: Transaction,
  ownerId: string,
  options: DemoOptions,
) {
  const organizations = await tx.organization.findMany({
    where: { OR: [{ id: DEMO_ORGANIZATION_ID }, { slug: DEMO_SLUG }] },
  });
  if (!organizations.length) return null;
  if (
    organizations.length !== 1 ||
    organizations[0].id !== DEMO_ORGANIZATION_ID ||
    organizations[0].slug !== DEMO_SLUG ||
    organizations[0].name !== DEMO_NAME
  )
    throw new Error(
      'Demo organization identity collision; existing organization will not be modified',
    );
  const marker = await tx.auditLog.findUnique({
    where: { id: DEMO_MARKER_ID },
  });
  const metadata = marker?.metadata;
  if (
    !marker ||
    marker.organizationId !== DEMO_ORGANIZATION_ID ||
    marker.action !== 'ORGANIZATION_CREATED' ||
    marker.entityId !== DEMO_ORGANIZATION_ID ||
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    metadata.demoSeed !== DEMO_VERSION ||
    metadata.ownerId !== ownerId ||
    typeof metadata.asOf !== 'string' ||
    !Number.isFinite(Date.parse(metadata.asOf))
  )
    throw new Error(
      'Demo provenance or owner mismatch; refusing to adopt or replace existing data',
    );
  const asOf = new Date(metadata.asOf);
  if (options.asOf && options.asOf.getTime() !== asOf.getTime())
    throw new Error(
      'Existing demo has a different --as-of; explicit reset is required to rebase timestamps',
    );
  return buildDemoData(ownerId, asOf);
}

// Check deterministic IDs globally, not merely counts within a tenant. Text,
// status and timestamps may be edited during a demo and are never overwritten.
async function validateDataset(tx: Transaction, data: Dataset) {
  const ids = (rows: { id?: string }[]) => rows.map((row) => row.id!);
  const membership = await tx.membership.findUnique({
    where: { id: DEMO_MEMBERSHIP_ID },
  });
  if (
    !membership ||
    membership.organizationId !== DEMO_ORGANIZATION_ID ||
    membership.userId !== data.membership.userId ||
    membership.role !== 'OWNER'
  )
    throw new Error('Demo OWNER membership is missing or has changed');
  const customers = await tx.customer.findMany({
    where: { id: { in: ids(data.customers) } },
  });
  const tags = await tx.tag.findMany({ where: { id: { in: ids(data.tags) } } });
  const tickets = await tx.ticket.findMany({
    where: { id: { in: ids(data.tickets) } },
  });
  const messages = await tx.ticketMessage.findMany({
    where: { id: { in: ids(data.messages) } },
  });
  const audits = await tx.auditLog.findMany({
    where: { id: { in: ids(data.audits) } },
  });
  for (const [actual, expected] of [
    [customers, data.customers],
    [tags, data.tags],
    [tickets, data.tickets],
    [messages, data.messages],
    [audits, data.audits],
  ] as const) {
    if (
      actual.length !== expected.length ||
      actual.some((row) => row.organizationId !== DEMO_ORGANIZATION_ID)
    )
      throw new Error(
        'Incomplete or cross-tenant demo records; no data will be replaced',
      );
  }
  const customerIds = new Set(ids(data.customers));
  const ticketIds = new Set(ids(data.tickets));
  if (
    tickets.some(
      (ticket) =>
        !customerIds.has(ticket.customerId) ||
        (ticket.assigneeMembershipId !== null &&
          ticket.assigneeMembershipId !== DEMO_MEMBERSHIP_ID),
    ) ||
    messages.some(
      (message) =>
        !ticketIds.has(message.ticketId) ||
        (message.authorMembershipId !== null &&
          message.authorMembershipId !== DEMO_MEMBERSHIP_ID),
    ) ||
    audits.some(
      (audit) =>
        audit.actorUserId !== data.membership.userId ||
        audit.actorMembershipId !== DEMO_MEMBERSHIP_ID,
    )
  )
    throw new Error(
      'Demo relations or audit actors do not belong to the expected tenant',
    );
  const links = await tx.ticketTag.findMany({
    where: {
      OR: [
        { ticketId: { in: [...ticketIds] } },
        { tagId: { in: ids(data.tags) } },
      ],
    },
  });
  const linkKeys = new Set(
    links.map((link) => `${link.ticketId}:${link.tagId}`),
  );
  if (
    data.links.some(
      (link) => !linkKeys.has(`${link.ticketId}:${link.tagId}`),
    ) ||
    links.some(
      (link) =>
        !ticketIds.has(link.ticketId) || !ids(data.tags).includes(link.tagId),
    )
  )
    throw new Error('Missing or cross-tenant demo tag links');
  return {
    customers: customers.length,
    tags: tags.length,
    tickets: tickets.length,
    messages: messages.length,
    ticketTags: data.links.length,
    auditEvents: audits.length,
  };
}

async function assertResetIsIsolated(tx: Transaction, data: Dataset) {
  const organizationId = DEMO_ORGANIZATION_ID;
  const ticketIds = data.tickets.map((row) => row.id!);
  const customerIds = data.customers.map((row) => row.id!);
  const messageIds = data.messages.map((row) => row.id!);
  const membershipId = DEMO_MEMBERSHIP_ID;
  // Refuse cascades into records created interactively, including another tenant
  // referencing seeded IDs (the schema has individual, not composite, FKs).
  const counts = [
    await tx.membership.count({ where: { organizationId } }),
    await tx.customer.count({ where: { organizationId } }),
    await tx.tag.count({ where: { organizationId } }),
    await tx.ticket.count({
      where: {
        OR: [
          { organizationId },
          { customerId: { in: customerIds } },
          { assigneeMembershipId: membershipId },
        ],
      },
    }),
    await tx.ticketMessage.count({
      where: {
        OR: [
          { organizationId },
          { ticketId: { in: ticketIds } },
          { authorMembershipId: membershipId },
        ],
      },
    }),
    await tx.auditLog.count({
      where: { OR: [{ organizationId }, { actorMembershipId: membershipId }] },
    }),
    await tx.ticketTag.count({
      where: {
        OR: [
          { ticketId: { in: ticketIds } },
          { tagId: { in: data.tags.map((row) => row.id!) } },
        ],
      },
    }),
  ];
  const expected = [1, 8, 5, 12, 48, data.audits.length, data.links.length];
  const extras = [
    await tx.invitation.count({ where: { organizationId } }),
    await tx.attachment.count({
      where: {
        OR: [
          { organizationId },
          { ticketId: { in: ticketIds } },
          { messageId: { in: messageIds } },
          { createdByMembershipId: membershipId },
        ],
      },
    }),
    await tx.emailDelivery.count({
      where: {
        OR: [
          { organizationId },
          { ticketId: { in: ticketIds } },
          { messageId: { in: messageIds } },
        ],
      },
    }),
  ];
  if (
    counts.some((count, index) => count !== expected[index]) ||
    extras.some((count) => count !== 0)
  )
    throw new Error(
      'Reset refused: additional records or external references exist; review them manually before resetting',
    );
}

export async function runDemo(
  prisma: PrismaClient,
  options: DemoOptions,
  env: NodeJS.ProcessEnv,
) {
  assertSafeDemoTarget(options, env);
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      const owner = await resolveOwner(tx, options);
      let data = await readDemo(tx, owner.id, options);
      if (options.action === 'reset') {
        if (!data)
          return { outcome: 'absent', organizationId: DEMO_ORGANIZATION_ID };
        await validateDataset(tx, data);
        await assertResetIsIsolated(tx, data);
        await tx.organization.delete({ where: { id: DEMO_ORGANIZATION_ID } });
        return { outcome: 'reset', organizationId: DEMO_ORGANIZATION_ID };
      }
      if (options.action === 'validate' && !data)
        throw new Error('Demo dataset has not been seeded');
      const existed = Boolean(data);
      if (!data) {
        data = buildDemoData(owner.id, options.asOf ?? new Date());
        await tx.organization.create({ data: data.organization });
        await tx.membership.create({ data: data.membership });
        // No skipDuplicates/upserts: an ID collision must roll back the entire seed.
        await tx.customer.createMany({ data: data.customers });
        await tx.tag.createMany({ data: data.tags });
        await tx.ticket.createMany({ data: data.tickets });
        await tx.ticketMessage.createMany({ data: data.messages });
        await tx.ticketTag.createMany({ data: data.links });
        await tx.auditLog.createMany({ data: data.audits });
      }
      const counts = await validateDataset(tx, data);
      return {
        outcome:
          options.action === 'validate'
            ? 'validated'
            : existed
              ? 'unchanged'
              : 'created',
        organizationId: DEMO_ORGANIZATION_ID,
        slug: DEMO_SLUG,
        ...counts,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 60_000,
    },
  );
}
