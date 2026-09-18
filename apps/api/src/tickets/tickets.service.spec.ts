import {
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

  const customerId =
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  beforeEach(() => {
    jest.clearAllMocks();

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
});