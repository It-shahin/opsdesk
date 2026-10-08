import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { MembershipsService } from '../memberships/memberships.service.js';
import { OrganizationsService } from './organizations.service.js';

describe('OrganizationsService', () => {
  const audit = {
    record: jest.fn<(...args: unknown[]) => ReturnType<AuditService['record']>>(),
    recordForTenant:
      jest.fn<
        (...args: unknown[]) => ReturnType<AuditService['recordForTenant']>
      >(),
  };
  const organization = {
    id: 'organization-1',
    name: 'OpsDesk',
    slug: 'opsdesk-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const membership = { id: 'membership-1', role: 'OWNER' };
  const transaction = {
    organization: { create: jest.fn<() => Promise<typeof organization>>() },
    membership: { create: jest.fn<() => Promise<typeof membership>>() },
  };
  const transactionMock = jest.fn(
    async (callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
  );
  const memberships = {
    listForUser: jest.fn<MembershipsService['listForUser']>(),
  };
  let service: OrganizationsService;

  beforeEach(() => {
    jest.resetAllMocks();
    transactionMock.mockImplementation(async (callback) =>
      callback(transaction),
    );
    transaction.organization.create.mockResolvedValue(organization);
    transaction.membership.create.mockResolvedValue(membership);
    service = new OrganizationsService(
      { $transaction: transactionMock } as unknown as PrismaService,
      memberships as unknown as MembershipsService,
      audit as unknown as AuditService,
    );
  });

  it('audits organization creation using the new owner and the same transaction client', async () => {
    const result = await service.createForUser('user-1', organization.name);
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      {
        organizationId: organization.id,
        actorUserId: 'user-1',
        actorMembershipId: membership.id,
        actorRole: 'OWNER',
        action: 'ORGANIZATION_CREATED',
        entityType: 'ORGANIZATION',
        entityId: organization.id,
      },
      transaction,
    );
    expect(audit.record.mock.calls[0]?.[1]).toBe(transaction);
    expect(
      transaction.membership.create.mock.invocationCallOrder[0],
    ).toBeLessThan(audit.record.mock.invocationCallOrder[0]);
    expect(audit.recordForTenant).not.toHaveBeenCalled();
    expect(result).toEqual({ ...organization, role: 'OWNER' });
  });

  it('does not audit organization creation if membership creation fails', async () => {
    const error = new Error('Membership insert failed');
    transaction.membership.create.mockRejectedValue(error);
    await expect(service.createForUser('user-1', 'OpsDesk')).rejects.toBe(
      error,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects the creation transaction when auditing fails', async () => {
    const error = new Error('Audit insert failed');
    audit.record.mockRejectedValue(error);
    await expect(service.createForUser('user-1', 'OpsDesk')).rejects.toBe(
      error,
    );
  });
});
