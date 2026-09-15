import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async listForOrganization(
    organizationId: string,
  ) {
    return this.prisma.membership.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        role: true,
        createdAt: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },

      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async updateRole(
    actor: TenantContext,
    membershipId: string,
    newRole: Role,
  ) {
    return this.prisma.$transaction(
      async (transaction) => {
        const target =
          await transaction.membership.findFirst({
            where: {
              id: membershipId,
              organizationId:
                actor.organizationId,
            },

            select: {
              id: true,
              userId: true,
              organizationId: true,
              role: true,

              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          });

        if (!target) {
          throw new NotFoundException(
            'Member not found',
          );
        }

        this.assertRoleChangeAllowed(
          actor.role,
          target.role,
          newRole,
        );

        if (
          target.role === 'OWNER' &&
          newRole !== 'OWNER'
        ) {
          const ownerCount =
            await transaction.membership.count({
              where: {
                organizationId:
                  actor.organizationId,
                role: 'OWNER',
              },
            });

          if (ownerCount <= 1) {
            throw new ConflictException(
              'Organization must have at least one owner',
            );
          }
        }

        const updated =
          await transaction.membership.update({
            where: {
              id: target.id,
            },

            data: {
              role: newRole,
            },

            select: {
              id: true,
              role: true,
              createdAt: true,
              updatedAt: true,

              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          });

        return updated;
      },
      {
        isolationLevel: 'Serializable',
      },
    );
  }

  private assertRoleChangeAllowed(
    actorRole: Role,
    targetRole: Role,
    newRole: Role,
  ): void {
    if (actorRole === 'OWNER') {
      return;
    }

    if (actorRole !== 'ADMIN') {
      throw new ForbiddenException(
        'Insufficient permissions',
      );
    }

    if (
      targetRole === 'OWNER' ||
      targetRole === 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Admins cannot modify owners or admins',
      );
    }

    if (
      newRole === 'OWNER' ||
      newRole === 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Admins cannot assign owner or admin roles',
      );
    }
  }
}