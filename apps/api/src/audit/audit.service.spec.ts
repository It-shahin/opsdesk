import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import { AuditService } from './audit.service.js';

describe('AuditService', () => {
  const tenant: TenantContext = {
    organizationId: 'organization-a',
    userId: 'user-a',
    membershipId: 'membership-a',
    role: 'OWNER',
  };
  const create = jest.fn<(args: unknown) => Promise<{ id: string; createdAt: Date }>>();
  const findMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const count = jest.fn<(args: unknown) => Promise<number>>();
  const transaction = jest.fn(async (operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );
  const prisma = {
    auditLog: { create, findMany, count },
    $transaction: transaction,
  };
  let service: AuditService;

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation(async (operations) =>
      Promise.all(operations),
    );
    create.mockResolvedValue({ id: 'audit-1', createdAt: new Date() });
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('stores absent customer/system actor fields as null', async () => {
    await service.record({
      organizationId: tenant.organizationId,
      action: 'TICKET_MESSAGE_CREATED',
      entityType: 'TICKET_MESSAGE',
      entityId: 'message-1',
      metadata: {
        ticketId: 'ticket-1',
        source: 'EMAIL',
        authorType: 'CUSTOMER',
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: tenant.organizationId,
        actorUserId: null,
        actorMembershipId: null,
        actorRole: null,
        action: 'TICKET_MESSAGE_CREATED',
        entityType: 'TICKET_MESSAGE',
        entityId: 'message-1',
        metadata: {
          ticketId: 'ticket-1',
          source: 'EMAIL',
          authorType: 'CUSTOMER',
        },
      },
      select: { id: true, createdAt: true },
    });
  });

  it('uses the supplied transaction client instead of the root Prisma client', async () => {
    const insert = jest.fn<(args: unknown) => Promise<{ id: string; createdAt: Date }>>();
    const client = { auditLog: { create: insert } };
    insert.mockResolvedValue({ id: 'audit-tx', createdAt: new Date() });
    await service.recordForTenant(
      tenant,
      {
        action: 'CUSTOMER_ARCHIVED',
        entityType: 'CUSTOMER',
        entityId: 'customer-1',
      },
      client as unknown as PrismaService,
    );
    expect(create).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith({
      data: {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        actorMembershipId: tenant.membershipId,
        actorRole: tenant.role,
        action: 'CUSTOMER_ARCHIVED',
        entityType: 'CUSTOMER',
        entityId: 'customer-1',
        metadata: undefined,
      },
      select: { id: true, createdAt: true },
    });
  });

  it('applies all filters to both the tenant-scoped results and count with stable ordering', async () => {
    count.mockResolvedValue(23);
    const result = await service.list(tenant.organizationId, {
      page: 2,
      limit: 10,
      action: 'TICKET_STATUS_CHANGED',
      entityType: 'TICKET',
      entityId: 'ticket-1',
      actorUserId: tenant.userId,
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-08T23:59:59Z',
    });
    const where = {
      organizationId: tenant.organizationId,
      action: 'TICKET_STATUS_CHANGED',
      entityType: 'TICKET',
      entityId: 'ticket-1',
      actorUserId: tenant.userId,
      createdAt: {
        gte: new Date('2026-10-01T00:00:00Z'),
        lte: new Date('2026-10-08T23:59:59Z'),
      },
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      }),
    );
    expect(count).toHaveBeenCalledWith({ where });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 23,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it.each([
    {
      from: '2026-10-01T00:00:00Z',
      expected: { gte: new Date('2026-10-01T00:00:00Z') },
    },
    {
      to: '2026-10-08T00:00:00Z',
      expected: { lte: new Date('2026-10-08T00:00:00Z') },
    },
  ])('supports an open-ended date filter', async ({ from, to, expected }) => {
    await service.list(tenant.organizationId, { page: 1, limit: 25, from, to });
    expect(count).toHaveBeenCalledWith({
      where: {
        organizationId: tenant.organizationId,
        createdAt: expected,
      },
    });
  });

  it('returns empty pagination without losing tenant scope', async () => {
    const result = await service.list(tenant.organizationId, {
      page: 1,
      limit: 25,
    });
    expect(count).toHaveBeenCalledWith({
      where: { organizationId: tenant.organizationId },
    });
    expect(result).toEqual({
      data: [],
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });

  it('rejects a reversed date range before querying the database', async () => {
    await expect(
      service.list(tenant.organizationId, {
        page: 1,
        limit: 25,
        from: '2026-10-08T00:00:00Z',
        to: '2026-10-01T00:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
