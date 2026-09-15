import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PermissionGuard } from '../rbac/permission.guard.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { RequirePermissions } from '../rbac/require-permissions.decorator.js';
import { TenantMembershipGuard } from '../tenancy/tenant-membership.guard.js';
import type { TenantAuthenticatedRequest } from '../tenancy/tenant-context.types.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@Controller(
  'v1/organizations/:organizationId/invitations',
)
@UseGuards(
  TenantMembershipGuard,
  PermissionGuard,
)
@RequirePermissions(
  PERMISSIONS.INVITATIONS_MANAGE,
)
export class InvitationsController {
  constructor(
    private readonly invitationsService:
      InvitationsService,
  ) {}

  @Post()
  async create(
    @Req()
    request: TenantAuthenticatedRequest,

    @Body()
    dto: CreateInvitationDto,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.invitationsService.create(
      tenant,
      dto.email,
      dto.role,
    );
  }

  @Get()
  async list(
    @Req()
    request: TenantAuthenticatedRequest,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.invitationsService.list(
      tenant.organizationId,
    );
  }

  @Delete(':invitationId')
  @HttpCode(200)
  async cancel(
    @Req()
    request: TenantAuthenticatedRequest,

    @Param(
      'invitationId',
      new ParseUUIDPipe(),
    )
    invitationId: string,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.invitationsService.cancel(
      tenant,
      invitationId,
    );
  }
}