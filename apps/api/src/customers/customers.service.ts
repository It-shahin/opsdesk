import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';

export type CreateCustomerInput = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
};

export type UpdateCustomerInput = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
};

@Injectable()
export class CustomersService {
  private async assertEmailAvailable(
  organizationId: string,
  email: string,
  excludeCustomerId?: string,
): Promise<void> {
  const duplicate =
    await this.prisma.customer.findFirst({
      where: {
        organizationId,

        email: {
          equals:
            email.toLowerCase(),
          mode: 'insensitive',
        },

        archivedAt: null,

        ...(excludeCustomerId
          ? {
              id: {
                not:
                  excludeCustomerId,
              },
            }
          : {}),
      },

      select: {
        id: true,
      },
    });

  if (duplicate) {
    throw new ConflictException(
      'An active customer with this email already exists',
    );
  }
}
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    tenant: TenantContext,
    input: CreateCustomerInput,
  ) {
    if (input.email) {
      await this.assertEmailAvailable(
        tenant.organizationId,
        input.email,
      );
    }

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
        archivedAt: true,
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
    status:
      | 'active'
      | 'archived'
      | 'all';
  },
) {
  const {
    page,
    limit,
    search,
    company,
    status,
  } = options;

  const skip =
    (page - 1) * limit;

  const archiveFilter =
    status === 'active'
      ? {
          archivedAt: null,
        }
      : status === 'archived'
        ? {
            archivedAt: {
              not: null,
            },
          }
        : {};

  const where = {
    organizationId,

    ...archiveFilter,

    ...(company
      ? {
          company: {
            contains: company,
            mode:
              'insensitive' as const,
          },
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode:
                  'insensitive' as const,
              },
            },
            {
              email: {
                contains: search,
                mode:
                  'insensitive' as const,
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
                mode:
                  'insensitive' as const,
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
        archivedAt: true,
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

async update(
  tenant: TenantContext,
  customerId: string,
  input: UpdateCustomerInput,
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
      'At least one customer field must be provided',
    );
  }

  const customer =
    await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
        email: true,
        archivedAt: true,
      },
    });

  if (!customer) {
    throw new NotFoundException(
      'Customer not found',
    );
  }

  if (customer.archivedAt) {
    throw new ConflictException(
      'Archived customers cannot be updated',
    );
  }

  if (
    typeof input.email === 'string'
  ) {
    await this.assertEmailAvailable(
      tenant.organizationId,
      input.email,
      customer.id,
    );
  }

  return this.prisma.customer.update({
    where: {
      id: customer.id,
    },

    data: {
      ...(input.name !== undefined
        ? {
            name: input.name,
          }
        : {}),

      ...(input.email !== undefined
        ? {
            email: input.email,
          }
        : {}),

      ...(input.phone !== undefined
        ? {
            phone: input.phone,
          }
        : {}),

      ...(input.company !== undefined
        ? {
            company:
              input.company,
          }
        : {}),

      ...(input.notes !== undefined
        ? {
            notes: input.notes,
          }
        : {}),
    },

    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async archive(
  tenant: TenantContext,
  customerId: string,
) {
  const customer =
    await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
        archivedAt: true,
      },
    });

  if (!customer) {
    throw new NotFoundException(
      'Customer not found',
    );
  }

  if (customer.archivedAt) {
    return this.findOne(
      tenant.organizationId,
      customer.id,
    );
  }

  return this.prisma.customer.update({
    where: {
      id: customer.id,
    },

    data: {
      archivedAt:
        new Date(),
    },

    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async restore(
  tenant: TenantContext,
  customerId: string,
) {
  const customer =
    await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId:
          tenant.organizationId,
      },

      select: {
        id: true,
        email: true,
        archivedAt: true,
      },
    });

  if (!customer) {
    throw new NotFoundException(
      'Customer not found',
    );
  }

  if (!customer.archivedAt) {
    return this.findOne(
      tenant.organizationId,
      customer.id,
    );
  }

  if (customer.email) {
    await this.assertEmailAvailable(
      tenant.organizationId,
      customer.email,
      customer.id,
    );
  }

  return this.prisma.customer.update({
    where: {
      id: customer.id,
    },

    data: {
      archivedAt: null,
    },

    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
}

