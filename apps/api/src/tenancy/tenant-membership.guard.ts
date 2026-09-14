import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import { UsersService } from '../users/users.service.js';
import { TenantContextService } from './tenant-context.service.js';
import type { TenantAuthenticatedRequest } from './tenant-context.types.js';

@Injectable()
export class TenantMembershipGuard
  implements CanActivate
{
  constructor(
    private readonly usersService:
      UsersService,
    private readonly tenantContextService:
      TenantContextService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context
        .switchToHttp()
        .getRequest<TenantAuthenticatedRequest>();

    const organizationId =
      request.params?.organizationId;

    if (
      typeof organizationId !== 'string' ||
      !isUUID(organizationId)
    ) {
      throw new BadRequestException(
        'Invalid organization ID',
      );
    }

    if (
      !request.auth?.sub ||
      !request.accessToken
    ) {
      throw new UnauthorizedException(
        'Authentication context is missing',
      );
    }

    const user =
      await this.usersService
        .syncAuthenticatedUser(request);

    const tenant =
      await this.tenantContextService.resolve(
        user.id,
        organizationId,
      );

    if (!tenant) {
      throw new NotFoundException(
        'Organization not found',
      );
    }

    request.tenant = tenant;

    return true;
  }
}
