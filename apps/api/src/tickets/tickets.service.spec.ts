import {
  BadRequestException,
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

  const membershipFindFirstMock =
    jest.fn();

  const tagFindFirstMock =
    jest.fn();

  const ticketTagUpsertMock =
    jest.fn();

  const ticketTagDeleteManyMock =
    jest.fn();

    const ticketMessageCreateMock =
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
        ticketMessageCreateMock,

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
  });

  it('rejects a tag outside the ticket tenant', async () => {
    ticketFindFirstMock.mockResolvedValue({
      id: 'ticket-1',
    });

    tagFindFirstMock.mockResolvedValue(
      null,
    );

    await expect(
      service.addTag(
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
  });

  it('does not tag a ticket outside the tenant', async () => {
    ticketFindFirstMock.mockResolvedValue(
      null,
    );

    await expect(
      service.addTag(
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
  });

  it('creates a public member reply', async () => {
  ticketFindFirstMock
    .mockResolvedValue({
      id: 'ticket-1',
      status: 'OPEN',
    });

  ticketMessageCreateMock
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
    ticketMessageCreateMock,
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
});

it('creates an internal note', async () => {
  ticketFindFirstMock
    .mockResolvedValue({
      id: 'ticket-1',
      status: 'OPEN',
    });

  ticketMessageCreateMock
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
    ticketMessageCreateMock,
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
});

it('rejects public replies on closed tickets', async () => {
  ticketFindFirstMock
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
    ticketMessageCreateMock,
  ).not.toHaveBeenCalled();
});

it('allows internal notes on closed tickets', async () => {
  ticketFindFirstMock
    .mockResolvedValue({
      id: 'ticket-1',
      status: 'CLOSED',
    });

  ticketMessageCreateMock
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
    ticketMessageCreateMock,
  ).toHaveBeenCalled();
});

it('does not create messages on tickets outside the tenant', async () => {
  ticketFindFirstMock
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
    ticketMessageCreateMock,
  ).not.toHaveBeenCalled();
});

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
