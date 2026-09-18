import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { TicketPriority } from '../generated/prisma/enums.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';

export type CreateTicketInput = {
  customerId: string;
  subject: string;
  description?: string;
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
}