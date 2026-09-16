import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
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

export class CreateCustomerDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => {
    const trimmed =
      trimOptional(value);

    return typeof trimmed === 'string'
      ? trimmed.toLowerCase()
      : trimmed;
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Transform(({ value }) =>
    trimOptional(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @Transform(({ value }) =>
    trimOptional(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;

  @Transform(({ value }) =>
    trimOptional(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}