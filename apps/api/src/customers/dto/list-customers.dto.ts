import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function trimOptional(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export class ListCustomersDto {
  @ApiProperty({
    type: String,
    required: false,
    enum: ['active', 'archived', 'all'],
    default: 'active',
  })
  @IsIn(['active', 'archived', 'all'])
  status: 'active' | 'archived' | 'all' = 'active';

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
    maxLength: 120,
  })
  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    maxLength: 120,
  })
  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;
}
