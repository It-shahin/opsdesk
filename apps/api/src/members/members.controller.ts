import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PermissionGuard } from '../rbac/permission.guard.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { RequirePermissions } from '../rbac/require-permissions.decorator.js';
import { TenantMembershipGuard } from '../tenancy/tenant-membership.guard.js';
import type { TenantAuthenticatedRequest } from '../tenancy/tenant-context.types.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { MembersService } from './members.service.js';

@Controller(
  'v1/organizations/:organizationId/members',
)
@UseGuards(
  TenantMembershipGuard,
  PermissionGuard,
)
export class MembersController {
  constructor(
    private readonly membersService:
      MembersService,
  ) {}

  @Get()
  @RequirePermissions(
    PERMISSIONS.MEMBERS_READ,
  )
  async list(
    @Req()
    request: TenantAuthenticatedRequest,
  ) {
    const tenant = request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.membersService
      .listForOrganization(
        tenant.organizationId,
      );
  }

  @Patch(':membershipId/role')
  @RequirePermissions(
    PERMISSIONS.MEMBERS_MANAGE,
  )
  async updateRole(
    @Req()
    request: TenantAuthenticatedRequest,

    @Param(
      'membershipId',
      new ParseUUIDPipe(),
    )
    membershipId: string,

    @Body()
    dto: UpdateMemberRoleDto,
  ) {
    const tenant = request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.membersService.updateRole(
      tenant,
      membershipId,
      dto.role,
    );
  }
}