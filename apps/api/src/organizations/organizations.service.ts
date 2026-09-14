import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createForUser(
    userId: string,
    name: string,
  ) {
    const slug = this.generateSlug(name);

    return this.prisma.$transaction(
      async (transaction) => {
        const organization =
          await transaction.organization.create({
            data: {
              name,
              slug,
            },
          });

        const membership =
          await transaction.membership.create({
            data: {
              userId,
              organizationId:
                organization.id,
              role: 'OWNER',
            },
          });

        return {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: membership.role,
          createdAt:
            organization.createdAt,
          updatedAt:
            organization.updatedAt,
        };
      },
    );
  }

  async listForUser(userId: string) {
    const memberships =
      await this.prisma.membership.findMany({
        where: {
          userId,
        },

        include: {
          organization: true,
        },

        orderBy: {
          createdAt: 'asc',
        },
      });

    return memberships.map(
      ({ organization, role }) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role,
        createdAt:
          organization.createdAt,
        updatedAt:
          organization.updatedAt,
      }),
    );
  }

  private generateSlug(name: string): string {
    const base = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

    const suffix = randomUUID().slice(0, 8);

    return `${
      base || 'organization'
    }-${suffix}`;
  }
}