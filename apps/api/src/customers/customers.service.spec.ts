import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import { CustomersService } from './customers.service.js';

describe('CustomersService', () => {
  let service: CustomersService;

  const createMock = jest.fn();
  const findManyMock = jest.fn();

  const prisma = {
    customer: {
      create: createMock,
      findMany: findManyMock,
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
    jest.clearAllMocks();

    service = new CustomersService(
      prisma as unknown as PrismaService,
    );
  });

  it('creates a customer inside the trusted tenant', async () => {
    const customer = {
      id:
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

      name: 'Jane Doe',
      email:
        'jane@example.com',

      phone: null,
      company: 'Acme',
      notes: null,

      createdAt:
        new Date(),

      updatedAt:
        new Date(),
    };

    createMock.mockResolvedValue(
      customer,
    );

    const result =
      await service.create(
        tenant,
        {
          name: 'Jane Doe',
          email:
            'jane@example.com',
          company: 'Acme',
        },
      );

    expect(
      createMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId:
            tenant.organizationId,

          name: 'Jane Doe',
          email:
            'jane@example.com',

          phone: undefined,
          company: 'Acme',
          notes: undefined,
        },
      }),
    );

    expect(result).toEqual(
      customer,
    );
  });

  it('lists customers only from the requested organization', async () => {
    findManyMock.mockResolvedValue(
      [],
    );

    await service.list(
      tenant.organizationId,
    );

    expect(
      findManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId:
            tenant.organizationId,
        },
      }),
    );
  });
});