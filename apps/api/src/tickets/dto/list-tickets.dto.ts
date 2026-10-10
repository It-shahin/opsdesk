import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type {
  TicketPriority,
  TicketStatus,
} from '../../generated/prisma/enums.js';

const TICKET_STATUSES = [
  'OPEN',
  'PENDING',
  'RESOLVED',
  'CLOSED',
] as const satisfies readonly TicketStatus[];

const TICKET_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
] as const satisfies readonly TicketPriority[];

const SORT_FIELDS = ['createdAt', 'updatedAt'] as const;

const SORT_ORDERS = ['asc', 'desc'] as const;

export type TicketSortBy = (typeof SORT_FIELDS)[number];

export type TicketSortOrder = (typeof SORT_ORDERS)[number];

function trimOptional(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length ? trimmed : undefined;
}

export class ListTicketsDto {
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
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    maxLength: 200,
  })
  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    enum: [...TICKET_STATUSES],
  })
  @IsOptional()
  @IsIn([...TICKET_STATUSES])
  status?: TicketStatus;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    enum: [...TICKET_PRIORITIES],
  })
  @IsOptional()
  @IsIn([...TICKET_PRIORITIES])
  priority?: TicketPriority;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  assigneeMembershipId?: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  tagId?: string;

  @ApiProperty({
    type: String,
    required: false,
    enum: [...SORT_FIELDS],
    default: 'updatedAt',
  })
  @IsIn([...SORT_FIELDS])
  sortBy: TicketSortBy = 'updatedAt';

  @ApiProperty({
    type: String,
    required: false,
    enum: [...SORT_ORDERS],
    default: 'desc',
  })
  @IsIn([...SORT_ORDERS])
  sortOrder: TicketSortOrder = 'desc';
}
