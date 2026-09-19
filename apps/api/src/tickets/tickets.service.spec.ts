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

import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import { TicketsService } from './tickets.service.js';

describe('TicketsService', () => {
  let service: TicketsService;

  const customerFindFirstMock =
    jest.fn();

  const ticketCreateMock =
    jest.fn();

  const ticketFindManyMock =
    jest.fn();

  const ticketFindFirstMock =
    jest.fn();

  const ticketUpdateMock =
    jest.fn();

  const transactionTicketFindFirstMock =
    jest.fn();

  const transactionTicketUpdateManyMock =
    jest.fn();

  const transactionClient = {
    ticket: {
      findFirst:
        transactionTicketFindFirstMock,

      updateMany:
        transactionTicketUpdateManyMock,
    },
  };

  type TransactionCallback = (
    transaction:
      typeof transactionClient,
  ) => unknown;

  const transactionMock =
    jest.fn<
      (
        callback: TransactionCallback,
      ) => Promise<unknown>
    >();

  const prisma = {
    customer: {
      findFirst:
        customerFindFirstMock,
    },

    ticket: {
      create:
        ticketCreateMock,

      findMany:
        ticketFindManyMock,

      findFirst:
        ticketFindFirstMock,

      update:
        ticketUpdateMock,
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

  const customerId =
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  beforeEach(() => {
    jest.resetAllMocks();

    transactionMock.mockImplementation(
      async (callback) =>
        callback(transactionClient),
    );

    service =
      new TicketsService(
        prisma as unknown as PrismaService,
      );
  });

  it('creates a ticket for an active customer inside the tenant', async () => {
    customerFindFirstMock
      .mockResolvedValue({
        id: customerId,
      });

    const ticket = {
      id:
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      subject:
        'Cannot log in',

      description:
        'Customer cannot access account.',

      status:
        'OPEN',

      priority:
        'HIGH',

      source:
        'MANUAL',

      customer: {
        id: customerId,
        name: 'Jane Doe',
      },
    };

    ticketCreateMock
      .mockResolvedValue(
        ticket,
      );

    const result =
      await service.create(
        tenant,
        {
          customerId,
          subject:
            'Cannot log in',

          description:
            'Customer cannot access account.',

          priority:
            'HIGH',
        },
      );

    expect(
      customerFindFirstMock,
    ).toHaveBeenCalledWith({
      where: {
        id:
          customerId,

        organizationId:
          tenant.organizationId,

        archivedAt:
          null,
      },

      select: {
        id: true,
      },
    });

    expect(
      ticketCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId:
            tenant.organizationId,

          customerId,

          subject:
            'Cannot log in',

          description:
            'Customer cannot access account.',

          priority:
            'HIGH',

          status:
            'OPEN',

          source:
            'MANUAL',
        },
      }),
    );

    expect(result).toEqual(
      ticket,
    );
  });

  it('uses NORMAL priority by default', async () => {
    customerFindFirstMock
      .mockResolvedValue({
        id: customerId,
      });

    ticketCreateMock
      .mockResolvedValue({
        id: 'ticket-1',
      });

    await service.create(
      tenant,
      {
        customerId,
        subject:
          'General question',
      },
    );

    expect(
      ticketCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data:
          expect.objectContaining({
            priority:
              'NORMAL',
          }),
      }),
    );
  });

  it('rejects a customer that is unavailable inside the tenant', async () => {
    customerFindFirstMock
      .mockResolvedValue(
        null,
      );

    await expect(
      service.create(
        tenant,
        {
          customerId,
          subject:
            'Cross tenant attempt',
        },
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      ticketCreateMock,
    ).not.toHaveBeenCalled();
  });

  it('lists only tickets from the tenant', async () => {
    ticketFindManyMock
      .mockResolvedValue([]);

    await service.list(
      tenant.organizationId,
    );

    expect(
      ticketFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId:
            tenant.organizationId,
        },

        take: 50,
      }),
    );
  });

  it('finds a ticket only inside the tenant', async () => {
    const ticketId =
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    ticketFindFirstMock.mockResolvedValue({
      id: ticketId,
      status: 'OPEN',
    });

    await service.findOne(
      tenant.organizationId,
      ticketId,
    );

    expect(
      ticketFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ticketId,
          organizationId:
            tenant.organizationId,
        },
      }),
    );
  });

  it('returns 404 when the ticket is not inside the tenant', async () => {
    ticketFindFirstMock.mockResolvedValue(
      null,
    );

    await expect(
      service.findOne(
        tenant.organizationId,
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolves an open ticket', async () => {
    const ticketId =
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    transactionTicketFindFirstMock
      .mockResolvedValueOnce({
        id: ticketId,
        status: 'OPEN',
      })
      .mockResolvedValueOnce({
        id: ticketId,
        status: 'RESOLVED',
        resolvedAt: new Date(),
        closedAt: null,
      });

    transactionTicketUpdateManyMock
      .mockResolvedValue({
        count: 1,
      });

    const result =
      await service.updateStatus(
        tenant,
        ticketId,
        'RESOLVED',
      );

    expect(
      transactionTicketUpdateManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ticketId,
          organizationId:
            tenant.organizationId,
          status: 'OPEN',
        },
        data:
          expect.objectContaining({
            status: 'RESOLVED',
            resolvedAt:
              expect.any(Date),
            closedAt: null,
          }),
      }),
    );

    expect(result.status).toBe(
      'RESOLVED',
    );
  });

  it('rejects invalid status transitions', async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
      });

    await expect(
      service.updateStatus(
        tenant,
        'ticket-1',
        'CLOSED',
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      transactionTicketUpdateManyMock,
    ).not.toHaveBeenCalled();
  });

  it('reopens a resolved ticket and clears lifecycle timestamps', async () => {
    transactionTicketFindFirstMock
      .mockResolvedValueOnce({
        id: 'ticket-1',
        status: 'RESOLVED',
      })
      .mockResolvedValueOnce({
        id: 'ticket-1',
        status: 'OPEN',
        resolvedAt: null,
        closedAt: null,
      });

    transactionTicketUpdateManyMock
      .mockResolvedValue({
        count: 1,
      });

    await service.updateStatus(
      tenant,
      'ticket-1',
      'OPEN',
    );

    expect(
      transactionTicketUpdateManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data:
          expect.objectContaining({
            status: 'OPEN',
            resolvedAt: null,
            closedAt: null,
          }),
      }),
    );
  });

  it('rejects a concurrent ticket status change', async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
      });

    transactionTicketUpdateManyMock
      .mockResolvedValue({
        count: 0,
      });

    await expect(
      service.updateStatus(
        tenant,
        'ticket-1',
        'PENDING',
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
