import { ApiResource, ApiResult } from '../openapi/api-documentation.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PermissionGuard } from '../rbac/permission.guard.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { RequirePermissions } from '../rbac/require-permissions.decorator.js';
import { TenantMembershipGuard } from '../tenancy/tenant-membership.guard.js';
import type { TenantAuthenticatedRequest } from '../tenancy/tenant-context.types.js';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { TagsService } from './tags.service.js';

@ApiResource('Tags')
@Controller(
  'v1/organizations/:organizationId/tags',
)
@UseGuards(
  TenantMembershipGuard,
  PermissionGuard,
)
export class TagsController {
  constructor(
    private readonly tagsService:
      TagsService,
  ) {}

  @ApiResult('Tags')
  @Get()
  @RequirePermissions(
    PERMISSIONS.TICKETS_READ,
  )
  async list(
    @Req()
    request:
      TenantAuthenticatedRequest,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.tagsService.list(
      tenant.organizationId,
    );
  }

  @ApiResult('Tag')
  @Post()
  @RequirePermissions(
    PERMISSIONS.TICKETS_WRITE,
  )
  async create(
    @Req()
    request:
      TenantAuthenticatedRequest,

    @Body()
    dto: CreateTagDto,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.tagsService.create(
      tenant,
      dto.name,
    );
  }
}