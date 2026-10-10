import { ApiResource, ApiResult } from '../openapi/api-documentation.js';
import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PermissionGuard } from '../rbac/permission.guard.js';

import { PERMISSIONS } from '../rbac/permissions.js';

import { RequirePermissions } from '../rbac/require-permissions.decorator.js';

import { TenantMembershipGuard } from '../tenancy/tenant-membership.guard.js';

import type { TenantAuthenticatedRequest } from '../tenancy/tenant-context.types.js';

import { AnalyticsService } from './analytics.service.js';

import { AnalyticsOverviewQueryDto } from './dto/analytics-overview-query.dto.js';

@ApiResource('Analytics')
@Controller('v1/organizations/:organizationId/analytics')
@UseGuards(TenantMembershipGuard, PermissionGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @ApiResult('Analytics')
  @Get('overview')
  @RequirePermissions(PERMISSIONS.ANALYTICS_READ)
  async overview(
    @Req()
    request: TenantAuthenticatedRequest,

    @Query()
    query: AnalyticsOverviewQueryDto,
  ) {
    const tenant = request.tenant;

    if (!tenant) {
      throw new ForbiddenException('Tenant context is required');
    }

    return this.analytics.getOverview(tenant.organizationId, query.range);
  }
}
