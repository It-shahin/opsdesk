import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import type { TicketPriority } from '../../generated/prisma/enums.js';

const TICKET_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
] as const satisfies readonly TicketPriority[];

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

export class CreateTicketDto {
  @IsUUID()
  customerId!: string;

  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @Transform(({ value }) =>
    trimOptional(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn([
    ...TICKET_PRIORITIES,
  ])
  priority?: TicketPriority;
}