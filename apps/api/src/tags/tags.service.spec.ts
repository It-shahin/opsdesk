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

import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import { TagsService } from './tags.service.js';

describe('TagsService', () => {
  let service: TagsService;

  const tagFindUniqueMock =
    jest.fn();

  const tagCreateMock =
    jest.fn();

  const prisma = {
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

    service = new TagsService(
      prisma as unknown as PrismaService,
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
  });
});
