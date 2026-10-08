import {
  ConflictException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import { TagsService } from './tags.service.js';

describe('TagsService', () => {
  const audit = {
    record: jest.fn<(...args: unknown[]) => ReturnType<AuditService['record']>>(),
    recordForTenant:
      jest.fn<
        (...args: unknown[]) => ReturnType<AuditService['recordForTenant']>
      >(),
  };

  let service: TagsService;

  const tagFindUniqueMock =
    jest.fn();

  const tagCreateMock =
    jest.fn();

  const transactionClient = {
    tag: { create: tagCreateMock },
  };
  const transactionMock = jest.fn(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  );

  const prisma = {
    $transaction: transactionMock,
    tag: {
      findUnique:
        tagFindUniqueMock,

      create:
        tagCreateMock,
    },
  };

  const tenant: TenantContext = {
    userId:
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

    organizationId:
      '11111111-1111-4111-8111-111111111111',

    membershipId:
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

    role: 'AGENT',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    transactionMock.mockImplementation(async (callback) => callback(transactionClient));

    service = new TagsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  it('creates a normalized organization tag', async () => {
    tagFindUniqueMock.mockResolvedValue(
      null,
    );

    tagCreateMock.mockResolvedValue({
      id: 'tag-1',
      name: 'Bug',
    });

    await service.create(
      tenant,
      'Bug',
    );

    expect(
      tagFindUniqueMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_normalizedName: {
            organizationId:
              tenant.organizationId,

            normalizedName:
              'bug',
          },
        },
      }),
    );

    expect(
      tagCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId:
            tenant.organizationId,

          name: 'Bug',
          normalizedName:
            'bug',
        },
      }),
    );

    expect(audit.recordForTenant).toHaveBeenCalledWith(
      tenant,
      {
        action: 'TAG_CREATED',
        entityType: 'TAG',
        entityId: 'tag-1',
      },
      transactionClient,
    );
    expect(audit.recordForTenant.mock.calls.at(-1)?.[2]).toBe(transactionClient);
  });

  it('rejects duplicate tag names inside the organization', async () => {
    tagFindUniqueMock.mockResolvedValue({
      id: 'existing-tag',
    });

    await expect(
      service.create(
        tenant,
        'BUG',
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      tagCreateMock,
    ).not.toHaveBeenCalled();
    expect(audit.recordForTenant).not.toHaveBeenCalled();
  });

  it('preserves duplicate-name race handling without auditing a failed creation', async () => {
    tagFindUniqueMock.mockResolvedValue(null);
    tagCreateMock.mockRejectedValue({ code: 'P2002' });
    await expect(service.create(tenant, 'Bug')).rejects.toBeInstanceOf(ConflictException);
    expect(audit.recordForTenant).not.toHaveBeenCalled();
  });

  it('rejects tag creation when auditing fails', async () => {
    tagFindUniqueMock.mockResolvedValue(null);
    tagCreateMock.mockResolvedValue({ id: 'tag-1' });
    const error = new Error('Audit insert failed');
    audit.recordForTenant.mockRejectedValue(error);
    await expect(service.create(tenant, 'Bug')).rejects.toBe(error);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
