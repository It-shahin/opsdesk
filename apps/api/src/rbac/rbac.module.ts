import { Module } from '@nestjs/common';

import { PermissionGuard } from './permission.guard.js';
import { PermissionsService } from './permissions.service.js';

@Module({
  providers: [
    PermissionsService,
    PermissionGuard,
  ],
  exports: [
    PermissionsService,
    PermissionGuard,
  ],
})
export class RbacModule {}