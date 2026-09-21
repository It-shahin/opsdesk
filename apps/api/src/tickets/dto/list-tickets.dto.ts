import {
  Transform,
  Type,
} from 'class-transformer';

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

const SORT_FIELDS = [
  'createdAt',
  'updatedAt',
] as const;

const SORT_ORDERS = [
  'asc',
  'desc',
] as const;

export type TicketSortBy =
  (typeof SORT_FIELDS)[number];

export type TicketSortOrder =
  (typeof SORT_ORDERS)[number];

function trimOptional(
  value: unknown,
) {
  if (
    typeof value !== 'string'
  ) {
    return value;
  }

  const trimmed =
    value.trim();

  return trimmed.length
    ? trimmed
    : undefined;
}

export class ListTicketsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @Transform(({ value }) =>
    trimOptional(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn([...TICKET_STATUSES])
  status?: TicketStatus;

  @IsOptional()
  @IsIn([...TICKET_PRIORITIES])
  priority?: TicketPriority;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  assigneeMembershipId?: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;

  @IsIn([...SORT_FIELDS])
  sortBy: TicketSortBy =
    'updatedAt';

  @IsIn([...SORT_ORDERS])
  sortOrder: TicketSortOrder =
    'desc';
}