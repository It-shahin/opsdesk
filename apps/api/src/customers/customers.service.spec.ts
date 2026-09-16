import { NotFoundException } from '@nestjs/common';
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

  const findFirstMock = jest.fn();
  const countMock = jest.fn();
  const transactionMock =
    jest.fn<
      (
        operations:
          Promise<unknown>[],
      ) => Promise<unknown[]>
    >();

  const prisma = {
    customer: {
      create: createMock,
      findMany: findManyMock,
      findFirst: findFirstMock,
      count: countMock,
    },

    $transaction:
      transactionMock,
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

    transactionMock.mockImplementation(
      async (operations) =>
        Promise.all(operations),
    );

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

  it('lists paginated customers only inside the tenant', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'customer-1',
        name: 'Jane Doe',
      },
    ]);

    countMock.mockResolvedValue(25);

    const result = await service.list(
      tenant.organizationId,
      {
        page: 2,
        limit: 10,
      },
    );

    expect(
      findManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId:
            tenant.organizationId,
        },
        skip: 10,
        take: 10,
      }),
    );

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('searches customers without removing tenant scope', async () => {
    findManyMock.mockResolvedValue(
      [],
    );
    countMock.mockResolvedValue(0);

    await service.list(
      tenant.organizationId,
      {
        page: 1,
        limit: 20,
        search: 'jane',
      },
    );

    expect(
      findManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where:
          expect.objectContaining({
            organizationId:
              tenant.organizationId,
            OR:
              expect.any(Array),
          }),
      }),
    );

    const call =
      findManyMock.mock.calls[0]?.[0] as {
        where: {
          OR: unknown[];
        };
      };

    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        {
          name: {
            contains: 'jane',
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: 'jane',
            mode: 'insensitive',
          },
        },
      ]),
    );
  });

  it('filters customers by company within the tenant', async () => {
    findManyMock.mockResolvedValue(
      [],
    );
    countMock.mockResolvedValue(0);

    await service.list(
      tenant.organizationId,
      {
        page: 1,
        limit: 20,
        company: 'acme',
      },
    );

    expect(
      findManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId:
            tenant.organizationId,
          company: {
            contains: 'acme',
            mode: 'insensitive',
          },
        },
      }),
    );
  });

  it('returns a customer only when it belongs to the tenant', async () => {
    const customer = {
      id:
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      name: 'Jane Doe',
    };

    findFirstMock.mockResolvedValue(
      customer,
    );

    const result = await service.findOne(
      tenant.organizationId,
      customer.id,
    );

    expect(
      findFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: customer.id,
          organizationId:
            tenant.organizationId,
        },
      }),
    );

    expect(result).toEqual(
      customer,
    );
  });

  it('returns 404 when the customer is not inside the tenant', async () => {
    findFirstMock.mockResolvedValue(
      null,
    );

    await expect(
      service.findOne(
        tenant.organizationId,
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
