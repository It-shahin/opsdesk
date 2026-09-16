import { Injectable } from '@nestjs/common';

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
  ) {
    return this.prisma.customer.findMany({
      where: {
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

      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}