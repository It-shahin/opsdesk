import { ApiProperty } from '@nestjs/swagger';
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

  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateCustomerDto {
  @ApiProperty({ type: String, required: true, minLength: 1, maxLength: 120 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    format: 'email',
    maxLength: 254,
  })
  @Transform(({ value }) => {
    const trimmed = trimOptional(value);

    return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ type: String, required: false, nullable: true, maxLength: 40 })
  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

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

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    maxLength: 2000,
  })
  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
