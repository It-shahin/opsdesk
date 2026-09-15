import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { TenantAuthenticatedRequest } from '../tenancy/tenant-context.types.js';
import type { Permission } from './permissions.js';
import { PermissionsService } from './permissions.service.js';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator.js';

@Injectable()
export class PermissionGuard
  implements CanActivate
{
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService:
      PermissionsService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const requiredPermissions =
      this.reflector
        .getAllAndOverride<Permission[]>(
          REQUIRED_PERMISSIONS_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    if (
      !requiredPermissions ||
      requiredPermissions.length === 0
    ) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<TenantAuthenticatedRequest>();

    const tenant = request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    const allowed =
      this.permissionsService
        .hasAllPermissions(
          tenant.role,
          requiredPermissions,
        );

    if (!allowed) {
      throw new ForbiddenException(
        'Insufficient permissions',
      );
    }

    return true;
  }
}