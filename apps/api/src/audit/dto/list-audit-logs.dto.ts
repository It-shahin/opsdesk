import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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

const AUDIT_ACTIONS = [
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

const AUDIT_ENTITY_TYPES = [
  'ORGANIZATION',
  'CUSTOMER',
  'TICKET',
  'TICKET_MESSAGE',
  'TAG',
  'MEMBERSHIP',
  'INVITATION',
] as const satisfies readonly AuditEntityType[];

export class ListAuditLogsDto {
  @ApiProperty({ type: 'integer', required: false, minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiProperty({
    type: 'integer',
    required: false,
    minimum: 1,
    maximum: 100,
    default: 25,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    enum: [...AUDIT_ACTIONS],
  })
  @IsOptional()
  @IsIn([...AUDIT_ACTIONS])
  action?: AuditAction;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    enum: [...AUDIT_ENTITY_TYPES],
  })
  @IsOptional()
  @IsIn([...AUDIT_ENTITY_TYPES])
  entityType?: AuditEntityType;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'ISO 8601 timestamp accepted by IsISO8601.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'ISO 8601 timestamp accepted by IsISO8601.',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
