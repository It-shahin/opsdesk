import { ApiProperty } from '@nestjs/swagger';
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

function trimOptional(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length ? trimmed : undefined;
}

export class CreateTicketDto {
  @ApiProperty({ type: String, required: true, format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ type: String, required: true, minLength: 1, maxLength: 200 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    maxLength: 5000,
  })
  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    enum: [...TICKET_PRIORITIES],
  })
  @IsOptional()
  @IsIn([...TICKET_PRIORITIES])
  priority?: TicketPriority;
}
