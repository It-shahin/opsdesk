import { Injectable, NotFoundException, } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';

export type CreateCustomerInput = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    tenant: TenantContext,
    input: CreateCustomerInput,
  ) {
    return this.prisma.customer.create({
      data: {
        organizationId:
          tenant.organizationId,

        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        notes: input.notes,
      },

      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async list(
  organizationId: string,
  options: {
    page: number;
    limit: number;
    search?: string;
    company?: string;
  },
) {
  const {
    page,
    limit,
    search,
    company,
  } = options;

  const skip =
    (page - 1) * limit;

  const where = {
    organizationId,

    ...(company
      ? {
          company: {
            contains: company,
            mode: 'insensitive' as const,
          },
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              email: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              phone: {
                contains: search,
              },
            },
            {
              company: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {}),
  };

  const [
    customers,
    total,
  ] = await this.prisma.$transaction([
    this.prisma.customer.findMany({
      where,

      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      skip,
      take: limit,
    }),

    this.prisma.customer.count({
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
    data: customers,

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
  customerId: string,
) {
  const customer =
    await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },

      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

  if (!customer) {
    throw new NotFoundException(
      'Customer not found',
    );
  }

  return customer;
}
}