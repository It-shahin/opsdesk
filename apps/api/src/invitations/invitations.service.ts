import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
} from 'node:crypto';

import { PrismaService } from '../database/prisma.service.js';
import type { Role } from '../generated/prisma/enums.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';

const INVITATION_LIFETIME_MS =
  7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    actor: TenantContext,
    email: string,
    role: Role,
  ) {
    this.assertRoleAllowed(
      actor.role,
      role,
    );

    const normalizedEmail =
      email.trim().toLowerCase();

    const token =
      randomBytes(32).toString(
        'base64url',
      );

    const tokenHash =
        this.hashToken(token);

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() +
        INVITATION_LIFETIME_MS,
    );

    const invitation =
      await this.prisma.$transaction(
        async (transaction) => {
          const existingUser =
            await transaction.user.findUnique({
              where: {
                email:
                  normalizedEmail,
              },

              select: {
                id: true,
              },
            });

          if (existingUser) {
            const existingMembership =
              await transaction.membership.findUnique({
                where: {
                  userId_organizationId: {
                    userId:
                      existingUser.id,
                    organizationId:
                      actor.organizationId,
                  },
                },

                select: {
                  id: true,
                },
              });

            if (existingMembership) {
              throw new ConflictException(
                'User is already a member of this organization',
              );
            }
          }

          const pendingInvitation =
            await transaction.invitation.findFirst({
              where: {
                organizationId:
                  actor.organizationId,

                email:
                  normalizedEmail,

                acceptedAt: null,
                canceledAt: null,

                expiresAt: {
                  gt: now,
                },
              },

              select: {
                id: true,
              },
            });

          if (pendingInvitation) {
            throw new ConflictException(
              'A pending invitation already exists for this email',
            );
          }

          return transaction.invitation.create({
            data: {
              organizationId:
                actor.organizationId,

              email:
                normalizedEmail,

              role,

              tokenHash,

              invitedByUserId:
                actor.userId,

              expiresAt,
            },

            select: {
              id: true,
              email: true,
              role: true,
              expiresAt: true,
              acceptedAt: true,
              canceledAt: true,
              createdAt: true,
              updatedAt: true,

              invitedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });
        },
        {
          isolationLevel:
            'Serializable',
        },
      );

    return {
      ...this.toResponse(
        invitation,
      ),

      // Returned once for now.
      // Later this goes directly to the email job.
      acceptanceToken: token,
    };
  }

    private hashToken(
        token: string,
     ): string {
    return createHash('sha256')
    .update(token)
    .digest('hex');
}

  async list(
    organizationId: string,
  ) {
    const invitations =
      await this.prisma.invitation.findMany({
        where: {
          organizationId,
        },

        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          canceledAt: true,
          createdAt: true,
          updatedAt: true,

          invitedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

    return invitations.map(
      (invitation) =>
        this.toResponse(
          invitation,
        ),
    );
  }

  async cancel(
    actor: TenantContext,
    invitationId: string,
  ) {
    const invitation =
      await this.prisma.invitation.findFirst({
        where: {
          id: invitationId,

          organizationId:
            actor.organizationId,
        },

        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          canceledAt: true,
          createdAt: true,
          updatedAt: true,

          invitedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

    if (!invitation) {
      throw new NotFoundException(
        'Invitation not found',
      );
    }

    this.assertRoleAllowed(
      actor.role,
      invitation.role,
    );

    if (invitation.acceptedAt) {
      throw new ConflictException(
        'Accepted invitations cannot be canceled',
      );
    }

    if (invitation.canceledAt) {
      return this.toResponse(
        invitation,
      );
    }

    const canceled =
      await this.prisma.invitation.update({
        where: {
          id: invitation.id,
        },

        data: {
          canceledAt:
            new Date(),
        },

        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          canceledAt: true,
          createdAt: true,
          updatedAt: true,

          invitedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

    return this.toResponse(
      canceled,
    );
  }

  async accept(
  user: {
    id: string;
    email: string;
  },
  token: string,
) {
  const tokenHash =
    this.hashToken(token);

  const normalizedEmail =
    user.email.trim().toLowerCase();

  const now = new Date();

  return this.prisma.$transaction(
    async (transaction) => {
      const invitation =
        await transaction.invitation.findUnique({
          where: {
            tokenHash,
          },

          select: {
            id: true,
            organizationId: true,
            email: true,
            role: true,
            expiresAt: true,
            acceptedAt: true,
            canceledAt: true,

            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

      if (!invitation) {
        throw new NotFoundException(
          'Invitation not found',
        );
      }

      if (
        invitation.email.toLowerCase() !==
        normalizedEmail
      ) {
        throw new ForbiddenException(
          'Invitation does not belong to the authenticated user',
        );
      }

      if (invitation.acceptedAt) {
        throw new ConflictException(
          'Invitation has already been accepted',
        );
      }

      if (invitation.canceledAt) {
        throw new ConflictException(
          'Invitation has been canceled',
        );
      }

      if (
        invitation.expiresAt <= now
      ) {
        throw new ConflictException(
          'Invitation has expired',
        );
      }

      const existingMembership =
        await transaction.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId:
                invitation.organizationId,
            },
          },

          select: {
            id: true,
          },
        });

      if (existingMembership) {
        throw new ConflictException(
          'User is already a member of this organization',
        );
      }

      const claimed =
        await transaction.invitation.updateMany({
          where: {
            id: invitation.id,
            acceptedAt: null,
            canceledAt: null,

            expiresAt: {
              gt: now,
            },
          },

          data: {
            acceptedAt: now,
            acceptedByUserId:
              user.id,
          },
        });

      if (claimed.count !== 1) {
        throw new ConflictException(
          'Invitation is no longer available',
        );
      }

      const membership =
        await transaction.membership.create({
          data: {
            userId: user.id,
            organizationId:
              invitation.organizationId,
            role: invitation.role,
          },

          select: {
            id: true,
            role: true,
            createdAt: true,

            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

      return {
        membership: {
          id: membership.id,
          role: membership.role,
          createdAt:
            membership.createdAt,
        },

        organization:
          membership.organization,

        invitation: {
          id: invitation.id,
          acceptedAt: now,
        },
      };
    },
    {
      isolationLevel:
        'Serializable',
    },
  );
}

  private assertRoleAllowed(
    actorRole: Role,
    invitationRole: Role,
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
      invitationRole === 'OWNER' ||
      invitationRole === 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Admins cannot invite owners or admins',
      );
    }
  }

  private toResponse(invitation: {
    id: string;
    email: string;
    role: Role;
    expiresAt: Date;
    acceptedAt: Date | null;
    canceledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    invitedBy: {
      id: string;
      name: string | null;
      email: string;
    };
  }) {
    return {
      ...invitation,
      status:
        this.getStatus(
          invitation,
        ),
    };
  }

  private getStatus(invitation: {
    expiresAt: Date;
    acceptedAt: Date | null;
    canceledAt: Date | null;
  }) {
    if (invitation.acceptedAt) {
      return 'ACCEPTED' as const;
    }

    if (invitation.canceledAt) {
      return 'CANCELED' as const;
    }

    if (
      invitation.expiresAt <=
      new Date()
    ) {
      return 'EXPIRED' as const;
    }

    return 'PENDING' as const;
  }
}