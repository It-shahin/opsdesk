import { Injectable } from '@nestjs/common';

import type { Role } from '../generated/prisma/enums.js';
import type { Permission } from './permissions.js';
import { ROLE_PERMISSIONS } from './role-permissions.js';

@Injectable()
export class PermissionsService {
  hasPermission(
    role: Role,
    permission: Permission,
  ): boolean {
    const rolePermissions: readonly Permission[] =
      ROLE_PERMISSIONS[role];

    return rolePermissions.includes(permission);
  }

  hasAllPermissions(
    role: Role,
    permissions: readonly Permission[],
  ): boolean {
    return permissions.every(
      (permission) =>
        this.hasPermission(
          role,
          permission,
        ),
    );
  }
}
