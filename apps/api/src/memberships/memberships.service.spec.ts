import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { PrismaService } from '../database/prisma.service.js';
import { MembershipsService } from './memberships.service.js';

describe('MembershipsService', () => {
  let service: MembershipsService;

  const findUniqueMock = jest.fn();
  const findManyMock = jest.fn();

  const prisma = {
    membership: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MembershipsService(
      prisma as unknown as PrismaService,
    );
  });

  it('finds a membership by user and organization', async () => {
    const membership = {
      id: 'membership-1',
      userId: 'user-1',
      organizationId: 'organization-1',
      role: 'OWNER',
      organization: {
        id: 'organization-1',
        name: 'OpsDesk Demo',
        slug: 'opsdesk-demo-ab123456',
      },
    };

    findUniqueMock.mockResolvedValue(
      membership,
    );

    const result =
      await service.findForUserAndOrganization(
        'user-1',
        'organization-1',
      );

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: 'user-1',
          organizationId:
            'organization-1',
        },
      },
      include: {
        organization: true,
      },
    });

    expect(result).toEqual(membership);
  });

  it('returns null when the membership does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    const result =
      await service.findForUserAndOrganization(
        'user-1',
        'organization-2',
      );

    expect(result).toBeNull();
  });

  it('returns whether a membership exists', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'membership-1',
    });

    const result =
      await service.existsForUserAndOrganization(
        'user-1',
        'organization-1',
      );

    expect(result).toBe(true);
  });

  it('returns false when a membership does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    const result =
      await service.existsForUserAndOrganization(
        'user-1',
        'organization-2',
      );

    expect(result).toBe(false);
  });

  it('lists memberships for a user', async () => {
    const memberships = [
      {
        id: 'membership-1',
        userId: 'user-1',
        organizationId:
          'organization-1',
        role: 'OWNER',
        organization: {
          id: 'organization-1',
          name: 'OpsDesk Demo',
        },
      },
    ];

    findManyMock.mockResolvedValue(
      memberships,
    );

    const result =
      await service.listForUser('user-1');

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
      },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(result).toEqual(memberships);
  });
});