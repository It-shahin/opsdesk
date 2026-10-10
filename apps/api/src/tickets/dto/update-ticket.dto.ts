import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
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

export class UpdateTicketDto {
  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    minLength: 1,
    maxLength: 200,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    maxLength: 5000,
  })
  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    return trimmed.length ? trimmed : null;
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

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
