import { Transform, Type } from 'class-transformer';
import {
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

  return trimmed.length > 0
    ? trimmed
    : undefined;
}

export class ListCustomersDto {
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
  @MaxLength(120)
  search?: string;

  @Transform(({ value }) =>
    trimOptional(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;
}