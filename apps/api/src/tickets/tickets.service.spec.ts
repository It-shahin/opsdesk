import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import {
  MAX_MESSAGE_ATTACHMENTS_BYTES,
} from '../attachments/attachment-policy.js';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { PrismaService } from '../database/prisma.service.js';
import {
  JobsService,
} from '../jobs/jobs.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import type { RealtimeService } from '../realtime/realtime.service.js';
import { TicketsService } from './tickets.service.js';

describe('TicketsService', () => {
  let service: TicketsService;

  const customerFindFirstMock =
    jest.fn();

  const ticketCreateMock =
    jest.fn();

  const publishTicketCreatedMock =
    jest.fn<RealtimeService['publishTicketCreated']>();

  const publishTicketUpdatedMock =
    jest.fn<RealtimeService['publishTicketUpdated']>();

  const publishMessageCreatedMock =
    jest.fn<RealtimeService['publishMessageCreated']>();

  const publishEmailDeliveryUpdatedMock =
    jest.fn<RealtimeService['publishEmailDeliveryUpdated']>();

  const realtime = {
    publishTicketCreated: publishTicketCreatedMock,
    publishTicketUpdated: publishTicketUpdatedMock,
    publishMessageCreated: publishMessageCreatedMock,
    publishEmailDeliveryUpdated: publishEmailDeliveryUpdatedMock,
  };

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

  const txAttachmentFindManyMock =
    jest.fn();

  const txAttachmentUpdateManyMock =
    jest.fn();

  const txTicketMessageCreateMock =
    jest.fn();

  const txTicketMessageFindFirstMock =
    jest.fn();

  const txEmailDeliveryCreateMock =
    jest.fn();

  const ensureEmailDeliveryQueuedMock =
    jest.fn();

  const membershipFindFirstMock =
    jest.fn();

  const tagFindFirstMock =
    jest.fn();

  const ticketTagUpsertMock =
    jest.fn();

  const ticketTagDeleteManyMock =
    jest.fn();

    const ticketMessageFindManyMock =
      jest.fn();

    const ticketCountMock =
      jest.fn();

  const transactionClient = {
    ticket: {
      findFirst:
        transactionTicketFindFirstMock,

      updateMany:
        transactionTicketUpdateManyMock,
    },

    attachment: {
      findMany:
        txAttachmentFindManyMock,

      updateMany:
        txAttachmentUpdateManyMock,
    },

    ticketMessage: {
      create:
        txTicketMessageCreateMock,

      findFirst:
        txTicketMessageFindFirstMock,
    },

    emailDelivery: {
      create:
        txEmailDeliveryCreateMock,
    },
  };

  const transactionMock =
    jest.fn(
      async (
        input:
          | Promise<unknown>[]
          | ((
              tx: typeof transactionClient,
            ) => Promise<unknown>),
      ) => {
        if (
          Array.isArray(input)
        ) {
          return Promise.all(
            input,
          );
        }

        return input(
          transactionClient,
        );
      },
    );

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

      count:
        ticketCountMock,
    },

    membership: {
      findFirst:
        membershipFindFirstMock,
    },

    tag: {
      findFirst:
        tagFindFirstMock,
    },

    ticketTag: {
      upsert:
        ticketTagUpsertMock,

      deleteMany:
        ticketTagDeleteManyMock,
    },

    ticketMessage: {
      create:
        txTicketMessageCreateMock,

      findMany:
        ticketMessageFindManyMock,
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

  function expectTicketActivityUpdated() {
    expect(transactionTicketUpdateManyMock).toHaveBeenCalledTimes(1);
    expect(transactionTicketUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: 'ticket-1',
        organizationId: tenant.organizationId,
      },
      data: {
        updatedAt: expect.any(Date),
      },
    });
    expect(txTicketMessageCreateMock.mock.invocationCallOrder[0]).toBeLessThan(
      transactionTicketUpdateManyMock.mock.invocationCallOrder[0],
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();

    transactionMock.mockImplementation(
      async (input) => {
        if (Array.isArray(input)) {
          return Promise.all(input);
        }

        return input(
          transactionClient,
        );
      },
    );

    txTicketMessageFindFirstMock
      .mockResolvedValue({
        id: 'message-1',
        authorType: 'MEMBER',
        attachments: [],
      });

    txEmailDeliveryCreateMock
      .mockResolvedValue({
        id: 'email-delivery-1',
        status: 'PENDING',
      });

    ensureEmailDeliveryQueuedMock
      .mockResolvedValue(
        undefined,
      );

    service =
      new TicketsService(
        prisma as unknown as PrismaService,
        {
          ensureEmailDeliveryQueued:
            ensureEmailDeliveryQueuedMock,
        } as unknown as JobsService,
        realtime as unknown as RealtimeService,
      );
  });

  describe('existsInOrganization', () => {
    const ORG_A = '11111111-1111-4111-8111-111111111111';
    const TICKET_A = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    it.each([
      { description: 'found', record: { id: TICKET_A }, expected: true },
      { description: 'not found', record: null, expected: false },
    ])('returns $expected when the ticket is $description within the organization', async ({ record, expected }) => {
      ticketFindFirstMock.mockResolvedValue(record);

      await expect(service.existsInOrganization(ORG_A, TICKET_A)).resolves.toBe(expected);

      expect(ticketFindFirstMock).toHaveBeenCalledTimes(1);
      expect(ticketFindFirstMock).toHaveBeenCalledWith({
        where: { id: TICKET_A, organizationId: ORG_A },
        select: { id: true },
      });
    });
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

    expect(publishTicketCreatedMock).toHaveBeenCalledTimes(1);
    expect(publishTicketCreatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId: ticket.id,
    });

    expect(result).toBe(
      ticket,
    );
  });

  it('does not publish ticket creation when persistence fails', async () => {
    customerFindFirstMock.mockResolvedValue({ id: customerId });
    const error = new Error('Database unavailable');
    ticketCreateMock.mockRejectedValue(error);

    await expect(service.create(tenant, {
      customerId,
      subject: 'General question',
    })).rejects.toBe(error);

    expect(publishTicketCreatedMock).not.toHaveBeenCalled();
  });

  it('returns the persisted ticket when realtime publishing is skipped', async () => {
    customerFindFirstMock.mockResolvedValue({ id: customerId });
    const ticket = { id: 'ticket-1' };
    ticketCreateMock.mockResolvedValue(ticket);
    publishTicketCreatedMock.mockReturnValue(false);

    await expect(service.create(tenant, {
      customerId,
      subject: 'General question',
    })).resolves.toBe(ticket);

    expect(publishTicketCreatedMock).toHaveBeenCalledTimes(1);
    expect(publishTicketCreatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId: ticket.id,
    });
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
    expect(publishTicketCreatedMock).not.toHaveBeenCalled();
  });

  it('lists only tickets from the tenant', async () => {
    ticketFindManyMock
      .mockResolvedValue([]);

    ticketCountMock
      .mockResolvedValue(0);

    await service.list(
      tenant.organizationId,
      {
        page: 1,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
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

  it.each([
    { subject: 'Updated subject' },
    { description: null },
    { priority: 'HIGH' as const },
  ])('publishes a ticket update after saving %j', async (input) => {
    ticketFindFirstMock.mockResolvedValue({ id: 'ticket-1' });
    const ticket = { id: 'ticket-1', ...input };
    ticketUpdateMock.mockImplementation(async () => {
      expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
      return ticket;
    });
    publishTicketUpdatedMock.mockReturnValue(false);

    await expect(service.update(tenant, 'ticket-1', input)).resolves.toBe(ticket);

    expect(ticketUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ticket-1' },
      data: input,
    }));
    expect(publishTicketUpdatedMock).toHaveBeenCalledTimes(1);
    expect(publishTicketUpdatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId: ticket.id,
    });
  });

  it.each([{}, { subject: undefined }])(
    'does not publish a ticket update when no fields are provided: %j',
    async (input) => {
      await expect(service.update(tenant, 'ticket-1', input))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(ticketUpdateMock).not.toHaveBeenCalled();
      expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
    },
  );

  it('does not publish a ticket update for an unavailable ticket', async () => {
    ticketFindFirstMock.mockResolvedValue(null);
    await expect(service.update(tenant, 'foreign-ticket', {
      subject: 'Updated subject',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(ticketUpdateMock).not.toHaveBeenCalled();
    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
  });

  it('does not publish a ticket update when saving fails', async () => {
    ticketFindFirstMock.mockResolvedValue({ id: 'ticket-1' });
    const error = new Error('Database unavailable');
    ticketUpdateMock.mockRejectedValue(error);

    await expect(service.update(tenant, 'ticket-1', {
      subject: 'Updated subject',
    })).rejects.toBe(error);

    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
  });

  it('publishes status updates only after the transaction resolves', async () => {
    const ticket = { id: 'ticket-1', status: 'RESOLVED' };
    transactionTicketFindFirstMock
      .mockResolvedValueOnce({ id: ticket.id, status: 'OPEN' })
      .mockResolvedValueOnce(ticket);
    transactionTicketUpdateManyMock.mockResolvedValue({ count: 1 });

    let finishCommit!: () => void;
    const commit = new Promise<void>((resolve) => { finishCommit = resolve; });
    let markReady!: () => void;
    const ready = new Promise<void>((resolve) => { markReady = resolve; });
    transactionMock.mockImplementationOnce(async (input) => {
      if (Array.isArray(input)) {
        throw new Error('Expected an interactive transaction');
      }
      const result = await input(transactionClient);
      markReady();
      await commit;
      return result;
    });

    const pending = service.updateStatus(tenant, ticket.id, 'RESOLVED');
    await ready;
    try {
      expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
    } finally {
      finishCommit();
    }
    await expect(pending).resolves.toBe(ticket);

    expect(publishTicketUpdatedMock).toHaveBeenCalledTimes(1);
    expect(publishTicketUpdatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId: ticket.id,
    });
  });

  it('does not publish a status update if the transaction fails to commit', async () => {
    transactionTicketFindFirstMock
      .mockResolvedValueOnce({ id: 'ticket-1', status: 'OPEN' })
      .mockResolvedValueOnce({ id: 'ticket-1', status: 'RESOLVED' });
    transactionTicketUpdateManyMock.mockResolvedValue({ count: 1 });
    const error = new Error('Commit failed');
    transactionMock.mockImplementationOnce(async (input) => {
      if (Array.isArray(input)) {
        throw new Error('Expected an interactive transaction');
      }
      await input(transactionClient);
      throw error;
    });

    await expect(service.updateStatus(tenant, 'ticket-1', 'RESOLVED'))
      .rejects.toBe(error);
    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
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
    expect(publishTicketUpdatedMock).toHaveBeenCalledTimes(1);
    expect(publishTicketUpdatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId,
    });
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
    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
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
    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
  });

  it('assigns a ticket to an agent inside the tenant', async () => {
    const ticketId =
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    const membershipId =
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

    ticketFindFirstMock.mockResolvedValue({
      id: ticketId,
    });

    membershipFindFirstMock
      .mockResolvedValue({
        id: membershipId,
        role: 'AGENT',

        user: {
          id: 'user-agent',
          name: 'Agent',
          email:
            'agent@example.com',
          avatarUrl: null,
        },
      });

    ticketUpdateMock.mockResolvedValue({
      id: ticketId,

      assignee: {
        id: membershipId,
        role: 'AGENT',
      },
    });

    const result =
      await service.assign(
        tenant,
        ticketId,
        membershipId,
      );

    expect(
      membershipFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: membershipId,

          organizationId:
            tenant.organizationId,
        },
      }),
    );

    expect(
      ticketUpdateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ticketId,
        },

        data: {
          assigneeMembershipId:
            membershipId,
        },
      }),
    );

    expect(result.assignee.id).toBe(
      membershipId,
    );
    expect(publishTicketUpdatedMock).toHaveBeenCalledTimes(1);
    expect(publishTicketUpdatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId,
    });
  });

  it('rejects an assignee outside the tenant', async () => {
    ticketFindFirstMock.mockResolvedValue({
      id: 'ticket-1',
    });

    membershipFindFirstMock
      .mockResolvedValue(null);

    await expect(
      service.assign(
        tenant,
        'ticket-1',
        'foreign-membership',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      ticketUpdateMock,
    ).not.toHaveBeenCalled();
    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
  });

  it('prevents assigning tickets to viewers', async () => {
    ticketFindFirstMock.mockResolvedValue({
      id: 'ticket-1',
    });

    membershipFindFirstMock
      .mockResolvedValue({
        id: 'viewer-membership',
        role: 'VIEWER',

        user: {
          id: 'viewer-user',
        },
      });

    await expect(
      service.assign(
        tenant,
        'ticket-1',
        'viewer-membership',
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      ticketUpdateMock,
    ).not.toHaveBeenCalled();
    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
  });

  it('unassigns a ticket', async () => {
    ticketFindFirstMock.mockResolvedValue({
      id: 'ticket-1',
    });

    ticketUpdateMock.mockResolvedValue({
      id: 'ticket-1',
      assignee: null,
    });

    const result =
      await service.assign(
        tenant,
        'ticket-1',
        null,
      );

    expect(
      membershipFindFirstMock,
    ).not.toHaveBeenCalled();

    expect(
      ticketUpdateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          assigneeMembershipId:
            null,
        },
      }),
    );

    expect(result.assignee).toBeNull();
    expect(publishTicketUpdatedMock).toHaveBeenCalledTimes(1);
    expect(publishTicketUpdatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId: 'ticket-1',
    });
  });

  it('does not assign an unavailable ticket', async () => {
    ticketFindFirstMock.mockResolvedValue(
      null,
    );

    await expect(
      service.assign(
        tenant,
        'foreign-ticket',
        'some-membership',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      membershipFindFirstMock,
    ).not.toHaveBeenCalled();

    expect(
      ticketUpdateMock,
    ).not.toHaveBeenCalled();
    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
  });

  it('adds an organization tag to a ticket', async () => {
    const ticketId =
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    const tagId =
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

    ticketFindFirstMock
      .mockResolvedValueOnce({
        id: ticketId,
      })
      .mockResolvedValueOnce({
        id: ticketId,
        subject: 'Issue',
        tagLinks: [
          {
            tag: {
              id: tagId,
              name: 'Bug',
            },
          },
        ],
      });

    tagFindFirstMock.mockResolvedValue({
      id: tagId,
    });

    ticketTagUpsertMock
      .mockResolvedValue({});

    const result =
      await service.addTag(
        tenant,
        ticketId,
        tagId,
      );

    expect(
      tagFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: tagId,

          organizationId:
            tenant.organizationId,
        },
      }),
    );

    expect(
      ticketTagUpsertMock,
    ).toHaveBeenCalledWith({
      where: {
        ticketId_tagId: {
          ticketId,
          tagId,
        },
      },

      update: {},

      create: {
        ticketId,
        tagId,
      },
    });

    expect(result.tags).toEqual([
      {
        id: tagId,
        name: 'Bug',
      },
    ]);
    expect(publishTicketUpdatedMock).toHaveBeenCalledTimes(1);
    expect(publishTicketUpdatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId,
    });
  });

  it.each(['addTag', 'removeTag'] as const)(
    '%s rejects a tag outside the ticket tenant', async (operation) => {
    ticketFindFirstMock.mockResolvedValue({
      id: 'ticket-1',
    });

    tagFindFirstMock.mockResolvedValue(
      null,
    );

    await expect(
      service[operation](
        tenant,
        'ticket-1',
        'foreign-tag',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      ticketTagUpsertMock,
    ).not.toHaveBeenCalled();
    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
    expect(ticketTagDeleteManyMock).not.toHaveBeenCalled();
  });

  it.each(['addTag', 'removeTag'] as const)(
    '%s rejects a ticket outside the tenant', async (operation) => {
    ticketFindFirstMock.mockResolvedValue(
      null,
    );

    await expect(
      service[operation](
        tenant,
        'foreign-ticket',
        'tag-1',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      tagFindFirstMock,
    ).not.toHaveBeenCalled();

    expect(
      ticketTagUpsertMock,
    ).not.toHaveBeenCalled();
    expect(publishTicketUpdatedMock).not.toHaveBeenCalled();
    expect(ticketTagDeleteManyMock).not.toHaveBeenCalled();
  });

  it('removes a ticket tag', async () => {
    ticketFindFirstMock
      .mockResolvedValueOnce({
        id: 'ticket-1',
      })
      .mockResolvedValueOnce({
        id: 'ticket-1',
        subject: 'Issue',
        tagLinks: [],
      });

    tagFindFirstMock.mockResolvedValue({
      id: 'tag-1',
    });

    ticketTagDeleteManyMock
      .mockResolvedValue({
        count: 1,
      });

    const result =
      await service.removeTag(
        tenant,
        'ticket-1',
        'tag-1',
      );

    expect(
      ticketTagDeleteManyMock,
    ).toHaveBeenCalledWith({
      where: {
        ticketId:
          'ticket-1',

        tagId:
          'tag-1',
      },
    });

    expect(result.tags).toEqual([]);
    expect(publishTicketUpdatedMock).toHaveBeenCalledTimes(1);
    expect(publishTicketUpdatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId: 'ticket-1',
    });
  });

  it('creates a public member reply', async () => {
  transactionTicketFindFirstMock
    .mockResolvedValue({
      id: 'ticket-1',
      status: 'OPEN',
      customer: {
        email: 'customer@example.com',
      },
    });

  txTicketMessageCreateMock
    .mockResolvedValue({
      id: 'message-1',

      kind:
        'PUBLIC_REPLY',

      authorType:
        'MEMBER',

      source:
        'MANUAL',

      body:
        'We are looking into this.',
    });

  const result =
    await service.createMessage(
      tenant,
      'ticket-1',
      {
        kind:
          'PUBLIC_REPLY',

        body:
          'We are looking into this.',
      },
    );

  expect(
    txTicketMessageCreateMock,
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      data: {
        organizationId:
          tenant.organizationId,

        ticketId:
          'ticket-1',

        authorMembershipId:
          tenant.membershipId,

        kind:
          'PUBLIC_REPLY',

        authorType:
          'MEMBER',

        source:
          'MANUAL',

        body:
          'We are looking into this.',
      },
    }),
  );

  expect(
    result.authorType,
  ).toBe('MEMBER');
  expectTicketActivityUpdated();
  expect(publishMessageCreatedMock).toHaveBeenCalledWith({
    organizationId: tenant.organizationId,
    ticketId: 'ticket-1',
    messageId: 'message-1',
  });
  expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledWith({
    organizationId: tenant.organizationId,
    ticketId: 'ticket-1',
    messageId: 'message-1',
    emailDeliveryId: 'email-delivery-1',
    status: 'PENDING',
  });
});

it('creates an internal note', async () => {
  transactionTicketFindFirstMock
    .mockResolvedValue({
      id: 'ticket-1',
      status: 'OPEN',
    });

  txTicketMessageCreateMock
    .mockResolvedValue({
      id: 'message-1',
      kind:
        'INTERNAL_NOTE',
      authorType:
        'MEMBER',
      source:
        'MANUAL',
      body:
        'Customer called twice today.',
    });

  await service.createMessage(
    tenant,
    'ticket-1',
    {
      kind:
        'INTERNAL_NOTE',

      body:
        'Customer called twice today.',
    },
  );

  expect(
    txTicketMessageCreateMock,
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      data:
        expect.objectContaining({
          kind:
            'INTERNAL_NOTE',

          authorMembershipId:
            tenant.membershipId,
        }),
    }),
  );
  expect(publishMessageCreatedMock).toHaveBeenCalledWith({
    organizationId: tenant.organizationId,
    ticketId: 'ticket-1',
    messageId: 'message-1',
  });
  expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  expect(txEmailDeliveryCreateMock).not.toHaveBeenCalled();
  expectTicketActivityUpdated();
});

it(
  'queues outbound email after creating a public reply',
  async () => {
    const order: string[] = [];
    transactionMock.mockImplementationOnce(async (input) => {
      if (Array.isArray(input)) {
        throw new Error('Expected an interactive transaction');
      }
      const result = await input(transactionClient);
      expect(publishMessageCreatedMock).not.toHaveBeenCalled();
      expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
      expect(ensureEmailDeliveryQueuedMock).not.toHaveBeenCalled();
      expectTicketActivityUpdated();
      order.push('commit');
      return result;
    });
    publishMessageCreatedMock.mockImplementation(() => {
      order.push('message');
      return false;
    });
    publishEmailDeliveryUpdatedMock.mockImplementation(() => {
      order.push('delivery');
      return false;
    });
    ensureEmailDeliveryQueuedMock.mockImplementation(async () => {
      order.push('enqueue');
    });

    const ticketId =
      'ticket-1';

    const messageId =
      'message-1';

    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: ticketId,
        status: 'OPEN',
        customer: {
          email: 'customer@example.com',
        },
      });

    txTicketMessageCreateMock
      .mockResolvedValue({
        id: messageId,
      });

    txTicketMessageFindFirstMock
      .mockResolvedValue({
        id: messageId,
        kind: 'PUBLIC_REPLY',
        authorType: 'MEMBER',
        source: 'MANUAL',
        body: 'Hello customer.',
        attachments: [],
      });

    const result =
      await service.createMessage(
        tenant,
        ticketId,
        {
          kind: 'PUBLIC_REPLY',
          body: 'Hello customer.',
        },
      );

    expect(result.id).toBe(
      messageId,
    );

    expect(publishMessageCreatedMock).toHaveBeenCalledTimes(1);
    expect(publishMessageCreatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId,
      messageId,
    });
    expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledTimes(1);
    expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId,
      messageId,
      emailDeliveryId: 'email-delivery-1',
      status: 'PENDING',
    });
    expect(order).toEqual(['commit', 'message', 'delivery', 'enqueue']);

    expect(
      txEmailDeliveryCreateMock,
    ).toHaveBeenCalledWith({
      data: {
        organizationId:
          tenant.organizationId,
        ticketId,
        messageId,
        recipientEmail:
          'customer@example.com',
        status: 'PENDING',
        failedAt: null,
        lastError: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    expect(
      txEmailDeliveryCreateMock,
    ).toHaveBeenCalledTimes(
      1,
    );

    expect(
      ensureEmailDeliveryQueuedMock,
    ).toHaveBeenCalledWith(
      'email-delivery-1',
    );
  },
);

it(
  'records a failed delivery when the customer has no email address',
  async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
        customer: {
          email: null,
        },
      });

    txTicketMessageCreateMock
      .mockResolvedValue({
        id: 'message-1',
      });

    txTicketMessageFindFirstMock
      .mockResolvedValue({
        id: 'message-1',
        kind: 'PUBLIC_REPLY',
        attachments: [],
      });

    txEmailDeliveryCreateMock
      .mockResolvedValue({
        id: 'email-delivery-1',
        status: 'FAILED',
      });

    await service.createMessage(
      tenant,
      'ticket-1',
      {
        kind: 'PUBLIC_REPLY',
        body: 'Hello customer.',
      },
    );

    expect(
      txEmailDeliveryCreateMock,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientEmail: null,
        status: 'FAILED',
        failedAt:
          expect.any(Date),
        lastError:
          'Customer has no email address',
      }),
      select: {
        id: true,
        status: true,
      },
    });

    expect(
      ensureEmailDeliveryQueuedMock,
    ).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).toHaveBeenCalledTimes(1);
    expect(publishMessageCreatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId: 'ticket-1',
      messageId: 'message-1',
    });
    expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledTimes(1);
    expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId: 'ticket-1',
      messageId: 'message-1',
      emailDeliveryId: 'email-delivery-1',
      status: 'FAILED',
    });
  },
);

it(
  'does not queue email for internal notes',
  async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
        customer: {
          email: 'customer@example.com',
        },
      });

    txTicketMessageCreateMock
      .mockResolvedValue({
        id: 'message-1',
      });

    txTicketMessageFindFirstMock
      .mockResolvedValue({
        id: 'message-1',
        kind: 'INTERNAL_NOTE',
        authorType: 'MEMBER',
        source: 'MANUAL',
        body: 'Internal only.',
        attachments: [],
      });

    await service.createMessage(
      tenant,
      'ticket-1',
      {
        kind: 'INTERNAL_NOTE',
        body: 'Internal only.',
      },
    );

    expect(
      ensureEmailDeliveryQueuedMock,
    ).not.toHaveBeenCalled();
    expect(txEmailDeliveryCreateMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).toHaveBeenCalledTimes(1);
    expect(publishMessageCreatedMock).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ticketId: 'ticket-1',
      messageId: 'message-1',
    });
  },
);

it(
  'keeps the public reply when email enqueueing fails',
  async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
        customer: {
          email: 'customer@example.com',
        },
      });

    txTicketMessageCreateMock
      .mockResolvedValue({
        id: 'message-1',
      });

    txTicketMessageFindFirstMock
      .mockResolvedValue({
        id: 'message-1',
        kind: 'PUBLIC_REPLY',
        authorType: 'MEMBER',
        source: 'MANUAL',
        body: 'Saved reply.',
        attachments: [],
      });

    ensureEmailDeliveryQueuedMock
      .mockRejectedValue(
        new Error(
          'Redis unavailable',
        ),
      );

    await expect(
      service.createMessage(
        tenant,
        'ticket-1',
        {
          kind: 'PUBLIC_REPLY',
          body: 'Saved reply.',
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'message-1',
      }),
    );
    expect(publishMessageCreatedMock).toHaveBeenCalledTimes(1);
    expect(publishEmailDeliveryUpdatedMock).toHaveBeenCalledTimes(1);
  },
);

it.each(['PUBLIC_REPLY', 'INTERNAL_NOTE'] as const)(
  'does not bump activity when creating a %s fails',
  async (kind) => {
    transactionTicketFindFirstMock.mockResolvedValue({
      id: 'ticket-1',
      status: 'OPEN',
      customer: { email: 'customer@example.com' },
    });
    const error = new Error('Message creation failed');
    txTicketMessageCreateMock.mockRejectedValue(error);

    await expect(service.createMessage(tenant, 'ticket-1', {
      kind,
      body: 'Unpersisted message.',
    })).rejects.toBe(error);

    expect(transactionTicketUpdateManyMock).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(ensureEmailDeliveryQueuedMock).not.toHaveBeenCalled();
  },
);

it.each(['PUBLIC_REPLY', 'INTERNAL_NOTE'] as const)(
  'does not publish or enqueue %s when the activity update fails',
  async (kind) => {
    transactionTicketFindFirstMock.mockResolvedValue({
      id: 'ticket-1',
      status: 'OPEN',
      customer: { email: 'customer@example.com' },
    });
    txTicketMessageCreateMock.mockResolvedValue({ id: 'message-1' });
    const error = new Error('Activity update failed');
    transactionTicketUpdateManyMock.mockRejectedValue(error);

    await expect(service.createMessage(tenant, 'ticket-1', {
      kind,
      body: 'Saved only on commit.',
    })).rejects.toBe(error);

    expectTicketActivityUpdated();
    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
    expect(ensureEmailDeliveryQueuedMock).not.toHaveBeenCalled();
  },
);

it.each(['PUBLIC_REPLY', 'INTERNAL_NOTE'] as const)(
  'does not publish or enqueue %s if the transaction fails to commit',
  async (kind) => {
    transactionTicketFindFirstMock.mockResolvedValue({
      id: 'ticket-1',
      status: 'OPEN',
      customer: { email: 'customer@example.com' },
    });
    txTicketMessageCreateMock.mockResolvedValue({ id: 'message-1' });
    const error = new Error('Commit failed');
    transactionMock.mockImplementationOnce(async (input) => {
      if (Array.isArray(input)) {
        throw new Error('Expected an interactive transaction');
      }
      await input(transactionClient);
      throw error;
    });

    await expect(service.createMessage(tenant, 'ticket-1', {
      kind,
      body: 'Saved only on commit.',
    })).rejects.toBe(error);

    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
    expect(ensureEmailDeliveryQueuedMock).not.toHaveBeenCalled();
  },
);

it('rejects public replies on closed tickets', async () => {
  transactionTicketFindFirstMock
    .mockResolvedValue({
      id: 'ticket-1',
      status: 'CLOSED',
    });

  await expect(
    service.createMessage(
      tenant,
      'ticket-1',
      {
        kind:
          'PUBLIC_REPLY',

        body:
          'New response',
      },
    ),
  ).rejects.toBeInstanceOf(
    ConflictException,
  );

  expect(
    txTicketMessageCreateMock,
  ).not.toHaveBeenCalled();
  expect(publishMessageCreatedMock).not.toHaveBeenCalled();
  expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  expect(transactionTicketUpdateManyMock).not.toHaveBeenCalled();
});

it('allows internal notes on closed tickets', async () => {
  transactionTicketFindFirstMock
    .mockResolvedValue({
      id: 'ticket-1',
      status: 'CLOSED',
    });

  txTicketMessageCreateMock
    .mockResolvedValue({
      id: 'message-1',
      kind:
        'INTERNAL_NOTE',
    });

  await service.createMessage(
    tenant,
    'ticket-1',
    {
      kind:
        'INTERNAL_NOTE',

      body:
        'Post-resolution review.',
    },
  );

  expect(
    txTicketMessageCreateMock,
  ).toHaveBeenCalled();
  expectTicketActivityUpdated();
});

it('does not create messages on tickets outside the tenant', async () => {
  transactionTicketFindFirstMock
    .mockResolvedValue(null);

  await expect(
    service.createMessage(
      tenant,
      'foreign-ticket',
      {
        kind:
          'PUBLIC_REPLY',

        body:
          'Attempted cross-tenant reply',
      },
    ),
  ).rejects.toBeInstanceOf(
    NotFoundException,
  );

  expect(
    txTicketMessageCreateMock,
  ).not.toHaveBeenCalled();
  expect(publishMessageCreatedMock).not.toHaveBeenCalled();
  expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  expect(transactionTicketUpdateManyMock).not.toHaveBeenCalled();
});

it(
  'creates a message and links an uploaded attachment',
  async () => {
    const attachmentId =
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
        customer: {
          email: 'customer@example.com',
        },
      });

    txAttachmentFindManyMock
      .mockResolvedValue([
        {
          id: attachmentId,
          sizeBytes: 18,
        },
      ]);

    txTicketMessageCreateMock
      .mockResolvedValue({
        id: 'message-1',
      });

    txAttachmentUpdateManyMock
      .mockResolvedValue({
        count: 1,
      });

    txTicketMessageFindFirstMock
      .mockResolvedValue({
        id: 'message-1',
        kind: 'PUBLIC_REPLY',
        body: 'See attached.',
        attachments: [
          {
            id: attachmentId,
            originalName: 'hello.txt',
          },
        ],
      });

    const result =
      await service.createMessage(
        tenant,
        'ticket-1',
        {
          kind: 'PUBLIC_REPLY',
          body: 'See attached.',
          attachmentIds: [
            attachmentId,
          ],
        },
      );

    expect(
      txAttachmentFindManyMock,
    ).toHaveBeenCalledWith({
      where: {
        id: {
          in: [attachmentId],
        },
        organizationId:
          tenant.organizationId,
        ticketId: 'ticket-1',
        status: 'UPLOADED',
        messageId: null,
      },
      select: {
        id: true,
        sizeBytes: true,
      },
    });

    expect(
      txAttachmentUpdateManyMock,
    ).toHaveBeenCalledWith({
      where: {
        id: {
          in: [attachmentId],
        },
        organizationId:
          tenant.organizationId,
        ticketId: 'ticket-1',
        status: 'UPLOADED',
        messageId: null,
      },
      data: {
        messageId: 'message-1',
      },
    });

    expect(result.attachments).toEqual([
      expect.objectContaining({
        id: attachmentId,
      }),
    ]);
  },
);

it(
  'rejects attachments that exceed the maximum total message size',
  async () => {
    const attachmentIds = [
      'attachment-1',
      'attachment-2',
      'attachment-3',
    ];

    const sizeBytes =
      Math.floor(
        MAX_MESSAGE_ATTACHMENTS_BYTES /
          attachmentIds.length,
      ) + 1;

    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
      });

    txAttachmentFindManyMock
      .mockResolvedValue(
        attachmentIds.map(
          (id) => ({
            id,
            sizeBytes,
          }),
        ),
      );

    await expect(
      service.createMessage(
        tenant,
        'ticket-1',
        {
          kind: 'PUBLIC_REPLY',
          body: 'Too many bytes',
          attachmentIds,
        },
      ),
    ).rejects.toThrow(
      'Attachments exceed the maximum total size for a message',
    );

    expect(
      txTicketMessageCreateMock,
    ).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  },
);

it(
  'rejects pending attachments',
  async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
      });

    txAttachmentFindManyMock
      .mockResolvedValue([]);

    await expect(
      service.createMessage(
        tenant,
        'ticket-1',
        {
          kind: 'PUBLIC_REPLY',
          body: 'Attachment not finished.',
          attachmentIds: [
            'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          ],
        },
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      txTicketMessageCreateMock,
    ).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  },
);

it(
  'rejects an attachment from another ticket',
  async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
      });

    txAttachmentFindManyMock
      .mockResolvedValue([]);

    await expect(
      service.createMessage(
        tenant,
        'ticket-1',
        {
          kind: 'PUBLIC_REPLY',
          body: 'Wrong ticket attachment.',
          attachmentIds: [
            'attachment-from-ticket-2',
          ],
        },
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      txAttachmentFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where:
          expect.objectContaining({
            organizationId:
              tenant.organizationId,
            ticketId: 'ticket-1',
          }),
      }),
    );

    expect(
      txTicketMessageCreateMock,
    ).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  },
);

it(
  'rejects an attachment from another tenant',
  async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
      });

    txAttachmentFindManyMock
      .mockResolvedValue([]);

    await expect(
      service.createMessage(
        tenant,
        'ticket-1',
        {
          kind: 'PUBLIC_REPLY',
          body: 'Wrong tenant attachment.',
          attachmentIds: [
            'attachment-from-org-2',
          ],
        },
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      txAttachmentFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where:
          expect.objectContaining({
            organizationId:
              tenant.organizationId,
          }),
      }),
    );

    expect(
      txTicketMessageCreateMock,
    ).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  },
);

it(
  'rejects an attachment that is already linked',
  async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
      });

    txAttachmentFindManyMock
      .mockResolvedValue([]);

    await expect(
      service.createMessage(
        tenant,
        'ticket-1',
        {
          kind: 'PUBLIC_REPLY',
          body: 'Already linked attachment.',
          attachmentIds: [
            'already-linked-attachment',
          ],
        },
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      txAttachmentFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where:
          expect.objectContaining({
            messageId: null,
          }),
      }),
    );

    expect(
      txTicketMessageCreateMock,
    ).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  },
);

it(
  'rejects an attachment linked concurrently',
  async () => {
    transactionTicketFindFirstMock
      .mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
      });

    txAttachmentFindManyMock
      .mockResolvedValue([
        {
          id: 'attachment-1',
          sizeBytes: 18,
        },
      ]);

    txTicketMessageCreateMock
      .mockResolvedValue({
        id: 'message-1',
      });

    txAttachmentUpdateManyMock
      .mockResolvedValue({
        count: 0,
      });

    await expect(
      service.createMessage(
        tenant,
        'ticket-1',
        {
          kind: 'PUBLIC_REPLY',
          body: 'Race test',
          attachmentIds: [
            'attachment-1',
          ],
        },
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      txTicketMessageFindFirstMock,
    ).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  },
);

it(
  'rejects duplicate attachment IDs',
  async () => {
    const attachmentId =
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    await expect(
      service.createMessage(
        tenant,
        'ticket-1',
        {
          kind: 'PUBLIC_REPLY',
          body: 'Duplicate',
          attachmentIds: [
            attachmentId,
            attachmentId,
          ],
        },
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      transactionMock,
    ).not.toHaveBeenCalled();
    expect(publishMessageCreatedMock).not.toHaveBeenCalled();
    expect(publishEmailDeliveryUpdatedMock).not.toHaveBeenCalled();
  },
);

it('lists only messages for the ticket inside the tenant', async () => {
  ticketFindFirstMock
    .mockResolvedValue({
      id: 'ticket-1',
    });

  ticketMessageFindManyMock
    .mockResolvedValue([
      {
        id: 'message-2',
        body: 'Second',
      },
      {
        id: 'message-1',
        body: 'First',
      },
    ]);

  const result =
    await service.listMessages(
      tenant.organizationId,
      'ticket-1',
    );

  expect(
    ticketMessageFindManyMock,
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        organizationId:
          tenant.organizationId,

        ticketId:
          'ticket-1',
      },

      take: 100,
    }),
  );

  // DB returns newest-first,
  // API returns chronological order.
  expect(result).toEqual([
    {
      id: 'message-1',
      body: 'First',
    },
    {
      id: 'message-2',
      body: 'Second',
    },
  ]);
});

it('lists paginated tickets inside the tenant', async () => {
  ticketFindManyMock
    .mockResolvedValue([
      {
        id:
          'ticket-1',

        subject:
          'Login issue',

        tagLinks: [],
      },
    ]);

  ticketCountMock
    .mockResolvedValue(35);

  const result =
    await service.list(
      tenant.organizationId,
      {
        page: 2,
        limit: 10,
        sortBy:
          'updatedAt',
        sortOrder:
          'desc',
      },
    );

  expect(
    ticketFindManyMock,
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        organizationId:
          tenant.organizationId,
      },

      skip: 10,
      take: 10,

      orderBy: [
        {
          updatedAt:
            'desc',
        },
        {
          id:
            'desc',
        },
      ],
    }),
  );

  expect(
    result.pagination,
  ).toEqual({
    page: 2,
    limit: 10,
    total: 35,
    totalPages: 4,
    hasNextPage: true,
    hasPreviousPage: true,
  });
});

it('combines ticket filters without losing tenant scope', async () => {
  ticketFindManyMock
    .mockResolvedValue([]);

  ticketCountMock
    .mockResolvedValue(0);

  await service.list(
    tenant.organizationId,
    {
      page: 1,
      limit: 20,

      status: 'OPEN',
      priority: 'HIGH',

      customerId:
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

      assigneeMembershipId:
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      tagId:
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

      sortBy:
        'updatedAt',

      sortOrder:
        'desc',
    },
  );

  expect(
    ticketFindManyMock,
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      where:
        expect.objectContaining({
          organizationId:
            tenant.organizationId,

          status:
            'OPEN',

          priority:
            'HIGH',

          customerId:
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

          assigneeMembershipId:
            'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

          tagLinks: {
            some: {
              tagId:
                'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            },
          },
        }),
    }),
  );
});

it('searches tickets and customer data inside the tenant', async () => {
  ticketFindManyMock
    .mockResolvedValue([]);

  ticketCountMock
    .mockResolvedValue(0);

  await service.list(
    tenant.organizationId,
    {
      page: 1,
      limit: 20,

      search:
        'jane',

      sortBy:
        'updatedAt',

      sortOrder:
        'desc',
    },
  );

  const call =
    ticketFindManyMock
      .mock.calls[0][0];

  expect(
    call.where.organizationId,
  ).toBe(
    tenant.organizationId,
  );

  expect(
    call.where.OR,
  ).toEqual(
    expect.arrayContaining([
      {
        subject: {
          contains:
            'jane',

          mode:
            'insensitive',
        },
      },

      {
        description: {
          contains:
            'jane',

          mode:
            'insensitive',
        },
      },
    ]),
  );
});

it('filters tickets by tag', async () => {
  ticketFindManyMock
    .mockResolvedValue([]);

  ticketCountMock
    .mockResolvedValue(0);

  await service.list(
    tenant.organizationId,
    {
      page: 1,
      limit: 20,

      tagId:
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

      sortBy:
        'createdAt',

      sortOrder:
        'asc',
    },
  );

  expect(
    ticketFindManyMock,
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      where:
        expect.objectContaining({
          organizationId:
            tenant.organizationId,

          tagLinks: {
            some: {
              tagId:
                'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            },
          },
        }),

      orderBy: [
        {
          createdAt:
            'asc',
        },
        {
          id:
            'asc',
        },
      ],
    }),
  );
});
});
