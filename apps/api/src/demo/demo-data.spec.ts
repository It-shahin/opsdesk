import { describe, expect, it } from '@jest/globals';
import {
  buildDemoData,
  DEMO_MEMBERSHIP_ID,
  DEMO_ORGANIZATION_ID,
  demoId,
} from './demo-data.js';

describe('Northstar synthetic dataset', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const anchor = new Date('2026-01-30T00:00:00.000Z');
  const data = buildDemoData(ownerId, anchor);

  it('has reproducible UUIDv5 IDs and exactly the expected dataset', () => {
    expect(buildDemoData(ownerId, anchor)).toEqual(data);
    expect(demoId('ticket:0')).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-5[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
    expect(data.customers).toHaveLength(8);
    expect(data.tags).toHaveLength(5);
    expect(data.tickets).toHaveLength(12);
    expect(data.messages).toHaveLength(48);
    expect(data.audits).toHaveLength(35);
    expect(data.links).toHaveLength(13);
    expect(new Set(data.customers.map((row) => row.company)).size).toBe(8);
    expect(new Set(data.customers.map((row) => row.email)).size).toBe(8);
    expect(
      data.customers.every(
        (row) => row.email?.endsWith('@example.com') && !row.phone,
      ),
    ).toBe(true);
  });

  it('keeps every relation in the demo tenant with no external integrations', () => {
    const customerIds = new Set(data.customers.map((row) => row.id));
    const ticketIds = new Set(data.tickets.map((row) => row.id));
    const tagIds = new Set(data.tags.map((row) => row.id));
    for (const rows of [
      data.customers,
      data.tags,
      data.tickets,
      data.messages,
      data.audits,
    ])
      expect(
        rows.every((row) => row.organizationId === DEMO_ORGANIZATION_ID),
      ).toBe(true);
    expect(
      data.tickets.every(
        (row) =>
          customerIds.has(row.customerId) &&
          (!row.assigneeMembershipId ||
            row.assigneeMembershipId === DEMO_MEMBERSHIP_ID) &&
          row.source === 'MANUAL',
      ),
    ).toBe(true);
    expect(
      data.messages.every(
        (row) => ticketIds.has(row.ticketId) && row.source === 'MANUAL',
      ),
    ).toBe(true);
    expect(
      data.links.every(
        (row) => ticketIds.has(row.ticketId) && tagIds.has(row.tagId),
      ),
    ).toBe(true);
    expect(
      data.messages.filter((row) => row.kind === 'INTERNAL_NOTE'),
    ).toHaveLength(12);
    expect(data.membership).toMatchObject({ userId: ownerId, role: 'OWNER' });
  });

  it('provides balanced statuses, mixed priorities, unassigned work and coherent history', () => {
    for (const status of ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'])
      expect(data.tickets.filter((row) => row.status === status)).toHaveLength(
        3,
      );
    expect(new Set(data.tickets.map((row) => row.priority)).size).toBe(4);
    expect(
      data.tickets.filter((row) => !row.assigneeMembershipId),
    ).toHaveLength(2);
    for (const ticket of data.tickets) {
      const created = ticket.createdAt as Date;
      expect(created.getTime()).toBeGreaterThan(
        anchor.getTime() - 30 * 86_400_000,
      );
      expect(created.getTime()).toBeLessThan(anchor.getTime());
      expect((ticket.updatedAt as Date).getTime()).toBeLessThan(
        anchor.getTime(),
      );
      if (ticket.resolvedAt)
        expect((ticket.resolvedAt as Date).getTime()).toBeGreaterThan(
          created.getTime(),
        );
      if (ticket.closedAt)
        expect((ticket.closedAt as Date).getTime()).toBeGreaterThan(
          (ticket.resolvedAt as Date).getTime(),
        );
      const messages = data.messages.filter(
        (row) => row.ticketId === ticket.id,
      );
      expect(
        messages.every(
          (row) =>
            (row.createdAt as Date).getTime() >= created.getTime() &&
            (row.createdAt as Date).getTime() <=
              (ticket.updatedAt as Date).getTime(),
        ),
      ).toBe(true);
    }
  });
});
