import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import type {
  AuditAction,
  AuditEntityType,
  Role,
} from '../generated/prisma/enums.js';

import type {
  TenantContext,
} from '../tenancy/tenant-context.types.js';

type AuditClient =
  Pick<
    PrismaService,
    'auditLog'
  >;

type AuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[];

export type AuditMetadata =
  Record<
    string,
    AuditMetadataValue
  >;

interface RecordAuditInput {
  organizationId:
    string;

  actorUserId?:
    string | null;

  actorMembershipId?:
    string | null;

  actorRole?:
    Role | null;

  action:
    AuditAction;

  entityType:
    AuditEntityType;

  entityId?:
    string | null;

  metadata?:
    AuditMetadata;
}

interface RecordTenantAuditInput {
  action:
    AuditAction;

  entityType:
    AuditEntityType;

  entityId?:
    string | null;

  metadata?:
    AuditMetadata;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async record(
    input:
      RecordAuditInput,

    client:
      AuditClient =
      this.prisma,
  ) {
    return client.auditLog
      .create({
        data: {
          organizationId:
            input.organizationId,

          actorUserId:
            input.actorUserId ??
            null,

          actorMembershipId:
            input.actorMembershipId ??
            null,

          actorRole:
            input.actorRole ??
            null,

          action:
            input.action,

          entityType:
            input.entityType,

          entityId:
            input.entityId ??
            null,

          metadata:
            input.metadata,
        },

        select: {
          id:
            true,

          createdAt:
            true,
        },
      });
  }

  async recordForTenant(
    tenant:
      TenantContext,

    input:
      RecordTenantAuditInput,

    client:
      AuditClient =
      this.prisma,
  ) {
    return this.record(
      {
        organizationId:
          tenant.organizationId,

        actorUserId:
          tenant.userId,

        actorMembershipId:
          tenant.membershipId,

        actorRole:
          tenant.role,

        ...input,
      },

      client,
    );
  }

  async list(
    organizationId:
      string,

    options: {
      page:
        number;

      limit:
        number;

      action?:
        AuditAction;

      entityType?:
        AuditEntityType;

      entityId?:
        string;

      actorUserId?:
        string;

      from?:
        string;

      to?:
        string;
    },
  ) {
    const {
      page,
      limit,
      action,
      entityType,
      entityId,
      actorUserId,
      from,
      to,
    } =
      options;

    if (
      from &&
      to &&
      new Date(
        from,
      ) >
        new Date(
          to,
        )
    ) {
      throw new BadRequestException(
        '`from` must be before `to`',
      );
    }

    const where = {
      organizationId,

      ...(action
        ? {
            action,
          }
        : {}),

      ...(entityType
        ? {
            entityType,
          }
        : {}),

      ...(entityId
        ? {
            entityId,
          }
        : {}),

      ...(actorUserId
        ? {
            actorUserId,
          }
        : {}),

      ...(from ||
      to
        ? {
            createdAt: {
              ...(from
                ? {
                    gte:
                      new Date(
                        from,
                      ),
                  }
                : {}),

              ...(to
                ? {
                    lte:
                      new Date(
                        to,
                      ),
                  }
                : {}),
            },
          }
        : {}),
    };

    const skip =
      (page - 1) *
      limit;

    const [
      logs,
      total,
    ] =
      await this.prisma
        .$transaction([
          this.prisma
            .auditLog
            .findMany({
              where,

              select: {
                id:
                  true,

                organizationId:
                  true,

                action:
                  true,

                entityType:
                  true,

                entityId:
                  true,

                actorUserId:
                  true,

                actorMembershipId:
                  true,

                actorRole:
                  true,

                metadata:
                  true,

                createdAt:
                  true,

                actorUser: {
                  select: {
                    id:
                      true,

                    name:
                      true,

                    email:
                      true,
                  },
                },
              },

              orderBy: [
                {
                  createdAt:
                    'desc',
                },

                {
                  id:
                    'desc',
                },
              ],

              skip,
              take:
                limit,
            }),

          this.prisma
            .auditLog
            .count({
              where,
            }),
        ]);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total /
              limit,
          );

    return {
      data:
        logs,

      pagination: {
        page,
        limit,
        total,
        totalPages,

        hasNextPage:
          page <
          totalPages,

        hasPreviousPage:
          page >
          1,
      },
    };
  }
}