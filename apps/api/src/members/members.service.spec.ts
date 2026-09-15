import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import { MembersService } from './members.service.js';

describe('MembersService', () => {
  let service: MembersService;

  const findManyMock = jest.fn();
  const findFirstMock = jest.fn();
  const countMock = jest.fn();
  const updateMock = jest.fn();

  const transactionClient = {
    membership: {
      findFirst: findFirstMock,
      count: countMock,
      update: updateMock,
    },
  };

  const transactionMock = jest.fn(
    async (
      callback: (
        tx: typeof transactionClient,
      ) => unknown,
    ) => callback(transactionClient),
  );

  const prisma = {
    membership: {
      findMany: findManyMock,
    },

    $transaction: transactionMock,
  };

  const owner: TenantContext = {
    userId: 'user-owner',
    organizationId:
      '11111111-1111-4111-8111-111111111111',
    membershipId: 'membership-owner',
    role: 'OWNER',
  };

  const admin: TenantContext = {
    ...owner,
    userId: 'user-admin',
    membershipId: 'membership-admin',
    role: 'ADMIN',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MembersService(
      prisma as unknown as PrismaService,
    );
  });

  it('lists only members from the requested organization', async () => {
    findManyMock.mockResolvedValue([]);

    await service.listForOrganization(
      owner.organizationId,
    );

    expect(
      findManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId:
            owner.organizationId,
        },
      }),
    );
  });

  it('allows an owner to promote an agent to admin', async () => {
    findFirstMock.mockResolvedValue({
      id: 'membership-agent',
      userId: 'user-agent',
      organizationId:
        owner.organizationId,
      role: 'AGENT',
      user: {
        id: 'user-agent',
        email: 'agent@example.com',
        name: 'Agent',
        avatarUrl: null,
      },
    });

    updateMock.mockResolvedValue({
      id: 'membership-agent',
      role: 'ADMIN',
    });

    const result =
      await service.updateRole(
        owner,
        'membership-agent',
        'ADMIN',
      );

    expect(
      updateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'membership-agent',
        },
        data: {
          role: 'ADMIN',
        },
      }),
    );

    expect(result).toEqual({
      id: 'membership-agent',
      role: 'ADMIN',
    });
  });

  it('allows an admin to change an agent to viewer', async () => {
    findFirstMock.mockResolvedValue({
      id: 'membership-agent',
      userId: 'user-agent',
      organizationId:
        admin.organizationId,
      role: 'AGENT',
      user: {},
    });

    updateMock.mockResolvedValue({
      id: 'membership-agent',
      role: 'VIEWER',
    });

    await expect(
      service.updateRole(
        admin,
        'membership-agent',
        'VIEWER',
      ),
    ).resolves.toEqual({
      id: 'membership-agent',
      role: 'VIEWER',
    });
  });

  it('prevents admins from modifying owners', async () => {
    findFirstMock.mockResolvedValue({
      id: 'membership-owner',
      userId: 'user-owner',
      organizationId:
        admin.organizationId,
      role: 'OWNER',
      user: {},
    });

    await expect(
      service.updateRole(
        admin,
        'membership-owner',
        'AGENT',
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });

  it('prevents admins from assigning admin or owner roles', async () => {
    findFirstMock.mockResolvedValue({
      id: 'membership-agent',
      userId: 'user-agent',
      organizationId:
        admin.organizationId,
      role: 'AGENT',
      user: {},
    });

    await expect(
      service.updateRole(
        admin,
        'membership-agent',
        'ADMIN',
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });

  it('prevents demoting the last owner', async () => {
    findFirstMock.mockResolvedValue({
      id: owner.membershipId,
      userId: owner.userId,
      organizationId:
        owner.organizationId,
      role: 'OWNER',
      user: {},
    });

    countMock.mockResolvedValue(1);

    await expect(
      service.updateRole(
        owner,
        owner.membershipId,
        'ADMIN',
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });

  it('allows an owner demotion when another owner exists', async () => {
    findFirstMock.mockResolvedValue({
      id: owner.membershipId,
      userId: owner.userId,
      organizationId:
        owner.organizationId,
      role: 'OWNER',
      user: {},
    });

    countMock.mockResolvedValue(2);

    updateMock.mockResolvedValue({
      id: owner.membershipId,
      role: 'ADMIN',
    });

    await expect(
      service.updateRole(
        owner,
        owner.membershipId,
        'ADMIN',
      ),
    ).resolves.toEqual({
      id: owner.membershipId,
      role: 'ADMIN',
    });
  });

  it('returns 404 for a membership outside the tenant', async () => {
    findFirstMock.mockResolvedValue(null);

    await expect(
      service.updateRole(
        owner,
        'foreign-membership',
        'VIEWER',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });
});