import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type {
  TicketPriority,
  TicketStatus,
} from '../generated/prisma/enums.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';

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
  constructor(
    private readonly prisma:
      PrismaService,
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

    return this.prisma.ticket.create({
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
  }

  async list(
    organizationId: string,
  ) {
    return this.prisma.ticket.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        subject: true,
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

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      // Temporary safety cap.
      // Proper pagination comes in 5F.
      take: 50,
    });
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
      },
    });

  if (!ticket) {
    throw new NotFoundException(
      'Ticket not found',
    );
  }

  return ticket;
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

  return this.prisma.ticket.update({
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
  return this.prisma.$transaction(
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
          },
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
    return this.prisma.ticket.update({
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

  return this.prisma.ticket.update({
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
}
}