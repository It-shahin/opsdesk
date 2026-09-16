import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

function nullableString(
  value: unknown,
) {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

export class UpdateCustomerDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @Transform(({ value }) => {
    const normalized =
      nullableString(value);

    return typeof normalized === 'string'
      ? normalized.toLowerCase()
      : normalized;
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @Transform(({ value }) =>
    nullableString(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @Transform(({ value }) =>
    nullableString(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string | null;

  @Transform(({ value }) =>
    nullableString(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}