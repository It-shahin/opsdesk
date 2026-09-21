import {
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async create(
    tenant: TenantContext,
    name: string,
  ) {
    const normalizedName =
      this.normalizeName(name);

    const existing =
      await this.prisma.tag.findUnique({
        where: {
          organizationId_normalizedName: {
            organizationId:
              tenant.organizationId,

            normalizedName,
          },
        },

        select: {
          id: true,
        },
      });

    if (existing) {
      throw new ConflictException(
        'A tag with this name already exists',
      );
    }

    try {
      return await this.prisma.tag.create({
        data: {
          organizationId:
            tenant.organizationId,

          name,
          normalizedName,
        },

        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      // Protect against a race where two
      // requests create the same tag after
      // both passed the initial lookup.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A tag with this name already exists',
        );
      }

      throw error;
    }
  }

  async list(
    organizationId: string,
  ) {
    return this.prisma.tag.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,

        _count: {
          select: {
            ticketLinks: true,
          },
        },
      },

      orderBy: {
        name: 'asc',
      },
    });
  }

  private normalizeName(
    name: string,
  ): string {
    return name
      .trim()
      .toLowerCase();
  }
}