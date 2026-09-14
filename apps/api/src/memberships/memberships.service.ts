import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findForUserAndOrganization(
    userId: string,
    organizationId: string,
  ) {
    return this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      include: {
        organization: true,
      },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.membership.findMany({
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
  }

  async existsForUserAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const membership =
      await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
        select: {
          id: true,
        },
      });

    return membership !== null;
  }
}