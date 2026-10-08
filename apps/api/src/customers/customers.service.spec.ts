import {
  ConflictException,
  NotFoundException,
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
import { CustomersService } from './customers.service.js';

describe('CustomersService', () => {
  let service: CustomersService;

  const createMock = jest.fn();
  const findManyMock = jest.fn();

  const findFirstMock = jest.fn();
  const countMock = jest.fn();
  const updateMock = jest.fn();
  const audit = {
    record: jest.fn<(...args: unknown[]) => ReturnType<AuditService['record']>>(),
    recordForTenant:
      jest.fn<
        (...args: unknown[]) => ReturnType<AuditService['recordForTenant']>
      >(),
  };
  const transaction = {
    customer: {
      create: createMock,
      update: updateMock,
    },
  };
  const transactionMock =
    jest.fn<
      (
        operations:
          | Promise<unknown>[]
          | ((client: typeof transaction) => Promise<unknown>),
      ) => Promise<unknown>
    >();

  const prisma = {
    customer: {
      create: createMock,
      findMany: findManyMock,
      findFirst: findFirstMock,
      count: countMock,
      update: updateMock,
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
    jest.resetAllMocks();

    transactionMock.mockImplementation(
      async (operations) =>
        typeof operations === 'function'
          ? operations(transaction)
          : Promise.all(operations),
    );

    service = new CustomersService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
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

    expect(audit.recordForTenant).toHaveBeenCalledWith(
      tenant,
      {
        action: 'CUSTOMER_CREATED',
        entityType: 'CUSTOMER',
        entityId: customer.id,
      },
      transaction,
    );
    expect(audit.recordForTenant.mock.calls.at(-1)?.[2]).toBe(transaction);
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
        status: 'active',
      },
    );

    expect(
      findManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId:
            tenant.organizationId,
          archivedAt: null,
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
        status: 'active',
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
            archivedAt: null,
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
        status: 'active',
      },
    );

    expect(
      findManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId:
            tenant.organizationId,
          archivedAt: null,
          company: {
            contains: 'acme',
            mode: 'insensitive',
          },
        },
      }),
    );
  });

  it('lists only archived customers when requested', async () => {
    findManyMock.mockResolvedValue(
      [],
    );
    countMock.mockResolvedValue(0);

    await service.list(
      tenant.organizationId,
      {
        page: 1,
        limit: 20,
        status: 'archived',
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
            archivedAt: {
              not: null,
            },
          }),
      }),
    );
  });

  it('lists active and archived customers without an archive constraint', async () => {
    findManyMock.mockResolvedValue(
      [],
    );
    countMock.mockResolvedValue(0);

    await service.list(
      tenant.organizationId,
      {
        page: 1,
        limit: 20,
        status: 'all',
      },
    );

    const call =
      findManyMock.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
      };

    expect(call.where).toEqual(
      expect.objectContaining({
        organizationId:
          tenant.organizationId,
      }),
    );
    expect(call.where).not.toHaveProperty(
      'archivedAt',
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

  it('rejects duplicate active customer emails inside the same tenant', async () => {
    findFirstMock.mockResolvedValue({
      id: 'existing-customer',
    });

    await expect(
      service.create(
        tenant,
        {
          name: 'Another Jane',
          email:
            'jane@example.com',
        },
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      createMock,
    ).not.toHaveBeenCalled();
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

  it('updates a customer only after resolving it inside the tenant', async () => {
    findFirstMock.mockResolvedValueOnce({
      id: 'customer-1',
      email: 'old@example.com',
      archivedAt: null,
    });

    updateMock.mockResolvedValue({
      id: 'customer-1',
      name: 'Updated Customer',
    });

    const result = await service.update(
      tenant,
      'customer-1',
      {
        name: 'Updated Customer',
      },
    );

    expect(
      findFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'customer-1',
          organizationId:
            tenant.organizationId,
        },
      }),
    );

    expect(result).toEqual({
      id: 'customer-1',
      name: 'Updated Customer',
    });
  });

  it('prevents updates to archived customers', async () => {
    findFirstMock.mockResolvedValue({
      id: 'customer-1',
      email: 'jane@example.com',
      archivedAt: new Date(),
    });

    await expect(
      service.update(
        tenant,
        'customer-1',
        {
          name: 'Changed',
        },
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });

  it('archives a customer instead of deleting it', async () => {
    findFirstMock.mockResolvedValue({
      id: 'customer-1',
      archivedAt: null,
    });

    updateMock.mockResolvedValue({
      id: 'customer-1',
      archivedAt: new Date(),
    });

    const result = await service.archive(
      tenant,
      'customer-1',
    );

    expect(
      updateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'customer-1',
        },
        data: {
          archivedAt:
            expect.any(Date),
        },
      }),
    );

    expect(result.archivedAt).toEqual(
      expect.any(Date),
    );

    expect(audit.recordForTenant).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({
        action: 'CUSTOMER_ARCHIVED',
        entityType: 'CUSTOMER',
        entityId: 'customer-1',
      }),
      transaction,
    );
    expect(audit.recordForTenant.mock.calls.at(-1)?.[2]).toBe(transaction);
  });

  it('prevents restoring a customer when its email is now used by an active customer', async () => {
    findFirstMock
      .mockResolvedValueOnce({
        id: 'archived-customer',
        email:
          'jane@example.com',
        archivedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'active-customer',
      });

    await expect(
      service.restore(
        tenant,
        'archived-customer',
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });

  it('records update field names without customer values', async () => {
    findFirstMock
      .mockResolvedValueOnce({ id: 'customer-1', archivedAt: null })
      .mockResolvedValueOnce(null);
    updateMock.mockResolvedValue({ id: 'customer-1' });

    await service.update(tenant, 'customer-1', {
      name: 'Private name',
      email: 'private@example.com',
      phone: null,
      notes: 'Private notes',
      company: undefined,
    });

    expect(audit.recordForTenant).toHaveBeenCalledWith(
      tenant,
      {
        action: 'CUSTOMER_UPDATED',
        entityType: 'CUSTOMER',
        entityId: 'customer-1',
        metadata: { changedFields: ['name', 'email', 'phone', 'notes'] },
      },
      transaction,
    );
    expect(audit.recordForTenant.mock.calls.at(-1)?.[2]).toBe(transaction);
  });

  it('records restoration of an archived customer', async () => {
    findFirstMock.mockResolvedValue({
      id: 'customer-1', email: null, archivedAt: new Date(),
    });
    const customer = { id: 'customer-1', archivedAt: null };
    updateMock.mockResolvedValue(customer);

    await expect(service.restore(tenant, 'customer-1')).resolves.toEqual(customer);
    expect(audit.recordForTenant).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({
        action: 'CUSTOMER_RESTORED',
        entityType: 'CUSTOMER',
        entityId: customer.id,
      }),
      transaction,
    );
    expect(audit.recordForTenant.mock.calls.at(-1)?.[2]).toBe(transaction);
  });

  it.each(['archive', 'restore'] as const)(
    'skips mutation and audit for an idempotent %s request',
    async (method) => {
      const customer = {
        id: 'customer-1',
        archivedAt: method === 'archive' ? new Date() : null,
      };
      findFirstMock.mockResolvedValue(customer);

      await expect(service[method](tenant, customer.id)).resolves.toEqual(customer);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
      expect(audit.recordForTenant).not.toHaveBeenCalled();
    },
  );

  it.each(['create', 'update', 'archive', 'restore'] as const)(
    'propagates an audit failure from the %s transaction',
    async (method) => {
      const customer = {
        id: 'customer-1',
        email: null,
        archivedAt: method === 'restore' ? new Date() : null,
      };
      findFirstMock.mockResolvedValue(customer);
      createMock.mockResolvedValue(customer);
      updateMock.mockResolvedValue(customer);
      const error = new Error('Audit insert failed');
      audit.recordForTenant.mockRejectedValue(error);

      const mutation = method === 'create'
        ? service.create(tenant, { name: 'Customer' })
        : method === 'update'
          ? service.update(tenant, customer.id, { name: 'Updated' })
          : service[method](tenant, customer.id);

      await expect(mutation).rejects.toBe(error);
      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(audit.recordForTenant).toHaveBeenCalledTimes(1);
    },
  );
});
