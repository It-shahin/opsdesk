import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
} from 'class-validator';

import type { Role } from '../../generated/prisma/enums.js';

const INVITABLE_ROLES = [
  'OWNER',
  'ADMIN',
  'AGENT',
  'VIEWER',
] as const satisfies readonly Role[];

export class CreateInvitationDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : value,
  )
  @IsEmail()
  email!: string;

  @IsIn([...INVITABLE_ROLES])
  role!: Role;
}