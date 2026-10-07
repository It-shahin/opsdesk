import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type {
  EmailDeliveryStatus,
  TicketPriority,
  TicketStatus,
} from '../generated/prisma/enums.js';

import type {
  TicketSortBy,
  TicketSortOrder,
} from './dto/list-tickets.dto.js';

import {
  JobsService,
} from '../jobs/jobs.service.js';

import type { TenantContext } from '../tenancy/tenant-context.types.js';

import {
  MAX_MESSAGE_ATTACHMENTS_BYTES,
} from '../attachments/attachment-policy.js';

import {
  RealtimeService,
} from '../realtime/realtime.service.js';

export type CreateTicketInput = {
  customerId: string;
  subject: string;
  description?: string;
  priority?: TicketPriority;
};

export type UpdateTicketInput = {
  subject?: string;
  description?: string | null;
  priority?: TicketPriority;
};

@Injectable()
export class TicketsService {
  private readonly logger =
    new Logger(
      TicketsService.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly jobsService:
      JobsService,

    private readonly realtime:
    RealtimeService,
  ) {}

  async create(
    tenant: TenantContext,
    input: CreateTicketInput,
  ) {
    const customer =
      await this.prisma.customer.findFirst({
        where: {
          id:
            input.customerId,

          organizationId:
            tenant.organizationId,

          archivedAt: null,
        },

        select: {
          id: true,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found',
      );
    }

    const ticket =
      await this.prisma.ticket.create({
      data: {
        organizationId:
          tenant.organizationId,

        customerId:
          customer.id,

        subject:
          input.subject,

        description:
          input.description,

        priority:
          input.priority ??
          'NORMAL',

        status: 'OPEN',
        source: 'MANUAL',
      },

      select: {
        id: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        source: true,
        createdAt: true,
        updatedAt: true,

        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },
      },
    });

    this.realtime
      .publishTicketCreated({
        organizationId:
          tenant.organizationId,

        ticketId:
          ticket.id,
      });

    return ticket;
  }

  async list(
  organizationId: string,
  options: {
    page: number;
    limit: number;
    search?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    customerId?: string;
    assigneeMembershipId?: string;
    tagId?: string;
    sortBy: TicketSortBy;
    sortOrder: TicketSortOrder;
  },
) {
  const {
    page,
    limit,
    search,
    status,
    priority,
    customerId,
    assigneeMembershipId,
    tagId,
    sortBy,
    sortOrder,
  } = options;

  const skip =
    (page - 1) * limit;

  const where = {
    organizationId,

    ...(status
      ? {
          status,
        }
      : {}),

    ...(priority
      ? {
          priority,
        }
      : {}),

    ...(customerId
      ? {
          customerId,
        }
      : {}),

    ...(assigneeMembershipId
      ? {
          assigneeMembershipId,
        }
      : {}),

    ...(tagId
      ? {
          tagLinks: {
            some: {
              tagId,
            },
          },
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              subject: {
                contains:
                  search,

                mode:
                  'insensitive' as const,
              },
            },

            {
              description: {
                contains:
                  search,

                mode:
                  'insensitive' as const,
              },
            },

            {
              customer: {
                is: {
                  OR: [
                    {
                      name: {
                        contains:
                          search,

                        mode:
                          'insensitive' as const,
                      },
                    },

                    {
                      email: {
                        contains:
                          search,

                        mode:
                          'insensitive' as const,
                      },
                    },

                    {
                      phone: {
                        contains:
                          search,
                      },
                    },

                    {
                      company: {
                        contains:
                          search,

                        mode:
                          'insensitive' as const,
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  const orderBy =
    sortBy === 'createdAt'
      ? [
          {
            createdAt:
              sortOrder,
          },
          {
            id:
              sortOrder,
          },
        ]
      : [
          {
            updatedAt:
              sortOrder,
          },
          {
            id:
              sortOrder,
          },
        ];

  const [
    tickets,
    total,
  ] = await this.prisma.$transaction([
    this.prisma.ticket.findMany({
      where,

      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        source: true,
        resolvedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,

        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },

        assignee: {
          select: {
            id: true,
            role: true,

            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },

        tagLinks: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy,

      skip,
      take:
        limit,
    }),

    this.prisma.ticket.count({
      where,
    }),
  ]);

  const totalPages =
    total === 0
      ? 0
      : Math.ceil(
          total / limit,
        );

  return {
    data:
      tickets.map(
        (ticket) =>
          this.mapTicket(
            ticket,
          ),
      ),

    pagination: {
      page,
      limit,
      total,
      totalPages,

      hasNextPage:
        page < totalPages,

      hasPreviousPage:
        page > 1,
    },
  };
}

  async findOne(
  organizationId: string,
  ticketId: string,
) {
  const ticket =
    await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organizationId,
      },

      select: {
        id: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        source: true,
        resolvedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,

        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            archivedAt: true,
          },
        },
        assignee: {
          select: {
            id: true,
            role: true,

            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        tagLinks: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },

          orderBy: {
            tag: {
              name: 'asc',
            },
          },
        },
      },
    });

  if (!ticket) {
    throw new NotFoundException(
      'Ticket not found',
    );
  }

  return this.mapTicket(
    ticket,
  );
}

async update(
  tenant: TenantContext,
  ticketId: string,
  input: UpdateTicketInput,
) {
  const providedFields =
    Object.entries(input).filter(
      ([, value]) =>
        value !== undefined,
    );

  if (
    providedFields.length === 0
  ) {
    throw new BadRequestException(
      'At least one ticket field must be provided',
    );
  }

  const ticket =
    await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!ticket) {
    throw new NotFoundException(
      'Ticket not found',
    );
  }

  const result =
    await this.prisma.ticket.update({
    where: {
      id: ticket.id,
    },

    data: {
      ...(input.subject !== undefined
        ? {
            subject:
              input.subject,
          }
        : {}),

      ...(input.description !== undefined
        ? {
            description:
              input.description,
          }
        : {}),

      ...(input.priority !== undefined
        ? {
            priority:
              input.priority,
          }
        : {}),
    },

    select: {
      id: true,
      subject: true,
      description: true,
      status: true,
      priority: true,
      source: true,
      resolvedAt: true,
      closedAt: true,
      createdAt: true,
      updatedAt: true,

      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
        },
      },
    },
  });

  this.realtime
    .publishTicketUpdated({
      organizationId:
        tenant.organizationId,

      ticketId:
        result.id,
    });

  return result;
}

private isStatusTransitionAllowed(
  current: TicketStatus,
  next: TicketStatus,
): boolean {
  const transitions: Record<
    TicketStatus,
    readonly TicketStatus[]
  > = {
    OPEN: [
      'PENDING',
      'RESOLVED',
    ],

    PENDING: [
      'OPEN',
      'RESOLVED',
    ],

    RESOLVED: [
      'OPEN',
      'CLOSED',
    ],

    CLOSED: [
      'OPEN',
    ],
  };

  return transitions[
    current
  ].includes(next);
}

async updateStatus(
  tenant: TenantContext,
  ticketId: string,
  nextStatus: TicketStatus,
) {
  const result =
    await this.prisma.$transaction(
    async (transaction) => {
      const ticket =
        await transaction.ticket.findFirst({
          where: {
            id: ticketId,
            organizationId:
              tenant.organizationId,
          },

          select: {
            id: true,
            status: true,

            customer: {
              select: {
                email: true,
              },
            },
          }
        });

      if (!ticket) {
        throw new NotFoundException(
          'Ticket not found',
        );
      }

      if (
        ticket.status ===
        nextStatus
      ) {
        throw new ConflictException(
          `Ticket is already ${nextStatus.toLowerCase()}`,
        );
      }

      if (
        !this.isStatusTransitionAllowed(
          ticket.status,
          nextStatus,
        )
      ) {
        throw new ConflictException(
          `Cannot transition ticket from ${ticket.status} to ${nextStatus}`,
        );
      }

      const now = new Date();

      const lifecycleData =
        this.getLifecycleTimestamps(
          nextStatus,
          now,
        );

      const updated =
        await transaction.ticket.updateMany({
          where: {
            id: ticket.id,
            organizationId:
              tenant.organizationId,

            // Compare-and-set:
            // ticket must still have the
            // status we validated above.
            status:
              ticket.status,
          },

          data: {
            status:
              nextStatus,

            ...lifecycleData,
          },
        });

      if (updated.count !== 1) {
        throw new ConflictException(
          'Ticket status changed concurrently',
        );
      }

      const result =
        await transaction.ticket.findFirst({
          where: {
            id: ticket.id,
            organizationId:
              tenant.organizationId,
          },

          select: {
            id: true,
            subject: true,
            description: true,
            status: true,
            priority: true,
            source: true,
            resolvedAt: true,
            closedAt: true,
            createdAt: true,
            updatedAt: true,

            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                company: true,
              },
            },
          },
        });

      if (!result) {
        throw new NotFoundException(
          'Ticket not found',
        );
      }

      return result;
    },
  );

  this.realtime
    .publishTicketUpdated({
      organizationId:
        tenant.organizationId,

      ticketId:
        result.id,
    });

  return result;
}

private getLifecycleTimestamps(
  nextStatus: TicketStatus,
  now: Date,
) {
  switch (nextStatus) {
    case 'OPEN':
      return {
        resolvedAt: null,
        closedAt: null,
      };

    case 'PENDING':
      return {};

    case 'RESOLVED':
      return {
        resolvedAt: now,
        closedAt: null,
      };

    case 'CLOSED':
      return {
        closedAt: now,
      };
  }
}

private assignmentSelect() {
  return {
    id: true,
    subject: true,
    description: true,
    status: true,
    priority: true,
    source: true,
    resolvedAt: true,
    closedAt: true,
    createdAt: true,
    updatedAt: true,

    customer: {
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
      },
    },

    assignee: {
      select: {
        id: true,
        role: true,

        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    },
  } as const;
}

async assign(
  tenant: TenantContext,
  ticketId: string,
  membershipId: string | null,
) {
  const ticket =
    await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!ticket) {
    throw new NotFoundException(
      'Ticket not found',
    );
  }

  if (membershipId === null) {
    const result =
      await this.prisma.ticket.update({
      where: {
        id: ticket.id,
      },

      data: {
        assigneeMembershipId:
          null,
      },

      select:
        this.assignmentSelect(),
    });

    this.realtime
      .publishTicketUpdated({
        organizationId:
          tenant.organizationId,

        ticketId:
          result.id,
      });

    return result;
  }

  const membership =
    await this.prisma.membership.findFirst({
      where: {
        id: membershipId,

        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
        role: true,

        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

  if (!membership) {
    throw new NotFoundException(
      'Assignee not found',
    );
  }

  if (
    membership.role === 'VIEWER'
  ) {
    throw new BadRequestException(
      'Viewers cannot be assigned tickets',
    );
  }

  const result =
    await this.prisma.ticket.update({
    where: {
      id: ticket.id,
    },

    data: {
      assigneeMembershipId:
        membership.id,
    },

    select:
      this.assignmentSelect(),
  });

  this.realtime
    .publishTicketUpdated({
      organizationId:
        tenant.organizationId,

      ticketId:
        result.id,
    });

  return result;
}

async addTag(
  tenant: TenantContext,
  ticketId: string,
  tagId: string,
) {
  const ticket =
    await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!ticket) {
    throw new NotFoundException(
      'Ticket not found',
    );
  }

  const tag =
    await this.prisma.tag.findFirst({
      where: {
        id: tagId,
        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!tag) {
    throw new NotFoundException(
      'Tag not found',
    );
  }

  await this.prisma.ticketTag.upsert({
    where: {
      ticketId_tagId: {
        ticketId:
          ticket.id,

        tagId:
          tag.id,
      },
    },

    update: {},

    create: {
      ticketId:
        ticket.id,

      tagId:
        tag.id,
    },
  });

  const result =
    await this.findOne(
      tenant.organizationId,
      ticket.id,
    );

  this.realtime
    .publishTicketUpdated({
      organizationId:
        tenant.organizationId,

      ticketId:
        ticket.id,
    });

  return result;
}

async removeTag(
  tenant: TenantContext,
  ticketId: string,
  tagId: string,
) {
  const ticket =
    await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!ticket) {
    throw new NotFoundException(
      'Ticket not found',
    );
  }

  const tag =
    await this.prisma.tag.findFirst({
      where: {
        id: tagId,
        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!tag) {
    throw new NotFoundException(
      'Tag not found',
    );
  }

  await this.prisma.ticketTag.deleteMany({
    where: {
      ticketId:
        ticket.id,

      tagId:
        tag.id,
    },
  });

  const result =
    await this.findOne(
      tenant.organizationId,
      ticket.id,
    );

  this.realtime
    .publishTicketUpdated({
      organizationId:
        tenant.organizationId,

      ticketId:
        ticket.id,
    });

  return result;
}

private mapTicket<
  T extends {
    tagLinks?: Array<{
      tag: {
        id: string;
        name: string;
      };
    }>;
  },
>(
  ticket: T,
) {
  if (
    !('tagLinks' in ticket) ||
    !ticket.tagLinks
  ) {
    return ticket;
  }

  const {
    tagLinks,
    ...rest
  } = ticket;

  return {
    ...rest,

    tags:
      tagLinks.map(
        ({ tag }) =>
          tag,
      ),
  };
}

private messageSelect() {
  return {
    id: true,
    kind: true,
    authorType: true,
    source: true,
    body: true,
    createdAt: true,
    updatedAt: true,

    authorMembership: {
      select: {
        id: true,
        role: true,

        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    },

    emailDelivery: {
      select: {
        id: true,
        status: true,
        sentAt: true,
        deliveredAt: true,
        failedAt: true,
        createdAt: true,
      },
    },

    attachments: {
      select: {
        id: true,
        originalName: true,
        contentType: true,
        sizeBytes: true,
        status: true,
        uploadedAt: true,
      },

      orderBy: {
        createdAt: 'asc',
      },
    },
  } as const;
}

async createMessage(
  tenant: TenantContext,
  ticketId: string,
  input: {
    kind:
      | 'PUBLIC_REPLY'
      | 'INTERNAL_NOTE';

    body: string;

    attachmentIds?: string[];
  },
) {
  const attachmentIds =
    input.attachmentIds ?? [];

  const uniqueAttachmentIds =
    [
      ...new Set(
        attachmentIds,
      ),
    ];

  if (
    uniqueAttachmentIds.length !==
    attachmentIds.length
  ) {
    throw new BadRequestException(
      'Duplicate attachment IDs are not allowed',
    );
  }

  const {
    message,
    emailDelivery,
  } =
    await this.prisma.$transaction(
      async (transaction) => {
      const ticket =
        await transaction.ticket.findFirst({
          where: {
            id: ticketId,

            organizationId:
              tenant.organizationId,
          },

          select: {
            id: true,
            status: true,

            customer: {
              select: {
                email: true,
              },
            },
          },
        });

      if (!ticket) {
        throw new NotFoundException(
          'Ticket not found',
        );
      }

      if (
        input.kind ===
          'PUBLIC_REPLY' &&
        ticket.status ===
          'CLOSED'
      ) {
        throw new ConflictException(
          'Closed tickets must be reopened before sending a public reply',
        );
      }

      let attachments:
        Array<{
          id: string;
          sizeBytes: number;
        }> = [];

      if (
        uniqueAttachmentIds.length >
        0
      ) {
        attachments =
          await transaction.attachment.findMany({
            where: {
              id: {
                in:
                  uniqueAttachmentIds,
              },

              organizationId:
                tenant.organizationId,

              ticketId:
                ticket.id,

              status:
                'UPLOADED',

              messageId:
                null,
            },

            select: {
              id: true,
              sizeBytes: true,
            },
          });

        if (
          attachments.length !==
          uniqueAttachmentIds.length
        ) {
          throw new ConflictException(
            'One or more attachments are unavailable',
          );
        }

        const totalAttachmentBytes =
          attachments.reduce(
            (
              total,
              attachment,
            ) =>
              total +
              attachment.sizeBytes,
            0,
          );

        if (
          totalAttachmentBytes >
          MAX_MESSAGE_ATTACHMENTS_BYTES
        ) {
          throw new BadRequestException(
            'Attachments exceed the maximum total size for a message',
          );
        }
      }

      const createdMessage =
        await transaction.ticketMessage.create({
          data: {
            organizationId:
              tenant.organizationId,

            ticketId:
              ticket.id,

            authorMembershipId:
              tenant.membershipId,

            kind:
              input.kind,

            authorType:
              'MEMBER',

            source:
              'MANUAL',

            body:
              input.body,
          },

          select: {
            id: true,
          },
        });

      await transaction.ticket.updateMany({
        where: {
          id:
            ticket.id,

          organizationId:
            tenant.organizationId,
        },

        data: {
          updatedAt:
            new Date(),
        },
      });

      if (
        uniqueAttachmentIds.length >
        0
      ) {
        const linked =
          await transaction.attachment.updateMany({
            where: {
              id: {
                in:
                  uniqueAttachmentIds,
              },

              organizationId:
                tenant.organizationId,

              ticketId:
                ticket.id,

              status:
                'UPLOADED',

              messageId:
                null,
            },

            data: {
              messageId:
                createdMessage.id,
            },
          });

        if (
          linked.count !==
          uniqueAttachmentIds.length
        ) {
          throw new ConflictException(
            'One or more attachments were linked concurrently',
          );
        }
      }

      let emailDelivery:
        {
          id: string;
          status:
            EmailDeliveryStatus;
        } | null =
        null;

      if (
        input.kind ===
        'PUBLIC_REPLY'
      ) {
        const recipientEmail =
          ticket.customer.email
            ?.trim()
            .toLowerCase() ||
          null;

        const hasRecipient =
          recipientEmail !==
          null;

        emailDelivery =
          await transaction
            .emailDelivery
            .create({
              data: {
                organizationId:
                  tenant.organizationId,

                ticketId:
                  ticket.id,

                messageId:
                  createdMessage.id,

                recipientEmail,

                status:
                  hasRecipient
                    ? 'PENDING'
                    : 'FAILED',

                failedAt:
                  hasRecipient
                    ? null
                    : new Date(),

                lastError:
                  hasRecipient
                    ? null
                    : 'Customer has no email address',
              },

              select: {
                id: true,
                status: true,
              },
            });
      }

      const result =
        await transaction.ticketMessage.findFirst({
          where: {
            id:
              createdMessage.id,

            organizationId:
              tenant.organizationId,

            ticketId:
              ticket.id,
          },

          select:
            this.messageSelect(),
        });

      if (!result) {
        throw new NotFoundException(
          'Message not found',
        );
      }

      return {
        message:
          result,

        emailDelivery,
      };
      },
    );

  this.realtime
    .publishMessageCreated({
      organizationId:
        tenant.organizationId,

      ticketId,

      messageId:
        message.id,
    });

  if (emailDelivery) {
    this.realtime
      .publishEmailDeliveryUpdated({
        organizationId:
          tenant.organizationId,

        ticketId,

        messageId:
          message.id,

        emailDeliveryId:
          emailDelivery.id,

        status:
          emailDelivery.status,
      });
  }

  if (
    emailDelivery?.status ===
    'PENDING'
  ) {
    try {
      await this.jobsService
        .ensureEmailDeliveryQueued(
          emailDelivery.id,
        );
    } catch (error) {
      this.logger.error(
        `Failed to queue email delivery ${emailDelivery.id}`,
        error instanceof Error
          ? error.stack
          : undefined,
      );
    }
  }

  return message;
}

async listMessages(
  organizationId: string,
  ticketId: string,
) {
  const ticket =
    await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!ticket) {
    throw new NotFoundException(
      'Ticket not found',
    );
  }

  const messages =
    await this.prisma.ticketMessage.findMany({
      where: {
        organizationId,
        ticketId:
          ticket.id,
      },

      select:
        this.messageSelect(),

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      // Return the latest conversation history.
      // Proper message cursor pagination can
      // be introduced later if required.
      take: 100,
    });

  return messages.reverse();
}

async existsInOrganization(
  organizationId: string,
  ticketId: string,
): Promise<boolean> {
  const ticket =
    await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organizationId,
      },

      select: {
        id: true,
      },
    });

  return ticket !== null;
}

}
