import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, MaxLength } from 'class-validator';

import type { Role } from '../../generated/prisma/enums.js';

const INVITABLE_ROLES = [
  'OWNER',
  'ADMIN',
  'AGENT',
  'VIEWER',
] as const satisfies readonly Role[];

export class CreateInvitationDto {
  @ApiProperty({
    type: String,
    required: true,
    format: 'email',
    maxLength: 254,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: String, required: true, enum: [...INVITABLE_ROLES] })
  @IsIn([...INVITABLE_ROLES])
  role!: Role;
}
