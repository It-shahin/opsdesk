import {
  Type,
} from 'class-transformer';

import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import type {
  AuditAction,
  AuditEntityType,
} from '../../generated/prisma/enums.js';

const AUDIT_ACTIONS =
  [
    'ORGANIZATION_CREATED',

    'CUSTOMER_CREATED',
    'CUSTOMER_UPDATED',
    'CUSTOMER_ARCHIVED',
    'CUSTOMER_RESTORED',

    'TICKET_CREATED',
    'TICKET_UPDATED',
    'TICKET_STATUS_CHANGED',
    'TICKET_ASSIGNEE_CHANGED',
    'TICKET_TAG_ADDED',
    'TICKET_TAG_REMOVED',
    'TICKET_MESSAGE_CREATED',

    'TAG_CREATED',

    'MEMBER_ROLE_CHANGED',

    'INVITATION_CREATED',
    'INVITATION_CANCELED',
    'INVITATION_ACCEPTED',
  ] as const satisfies readonly AuditAction[];

const AUDIT_ENTITY_TYPES =
  [
    'ORGANIZATION',
    'CUSTOMER',
    'TICKET',
    'TICKET_MESSAGE',
    'TAG',
    'MEMBERSHIP',
    'INVITATION',
  ] as const satisfies readonly AuditEntityType[];

export class ListAuditLogsDto {
  @Type(
    () =>
      Number,
  )
  @IsInt()
  @Min(1)
  page =
    1;

  @Type(
    () =>
      Number,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit =
    25;

  @IsOptional()
  @IsIn([
    ...AUDIT_ACTIONS,
  ])
  action?:
    AuditAction;

  @IsOptional()
  @IsIn([
    ...AUDIT_ENTITY_TYPES,
  ])
  entityType?:
    AuditEntityType;

  @IsOptional()
  @IsUUID()
  entityId?:
    string;

  @IsOptional()
  @IsUUID()
  actorUserId?:
    string;

  @IsOptional()
  @IsISO8601()
  from?:
    string;

  @IsOptional()
  @IsISO8601()
  to?:
    string;
}