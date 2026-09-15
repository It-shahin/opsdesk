import { IsIn } from 'class-validator';

import type { Role } from '../../generated/prisma/enums.js';

const ALLOWED_ROLES = [
  'OWNER',
  'ADMIN',
  'AGENT',
  'VIEWER',
] as const satisfies readonly Role[];

export class UpdateMemberRoleDto {
  @IsIn([...ALLOWED_ROLES])
  role!: Role;
}