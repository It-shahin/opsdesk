import { ApiResource, ApiResult } from '../openapi/api-documentation.js';
import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  PermissionGuard,
} from '../rbac/permission.guard.js';

import {
  PERMISSIONS,
} from '../rbac/permissions.js';

import {
  RequirePermissions,
} from '../rbac/require-permissions.decorator.js';

import {
  TenantMembershipGuard,
} from '../tenancy/tenant-membership.guard.js';

import type {
  TenantAuthenticatedRequest,
} from '../tenancy/tenant-context.types.js';

import {
  AuditService,
} from './audit.service.js';

import {
  ListAuditLogsDto,
} from './dto/list-audit-logs.dto.js';

@ApiResource('Audit')
@Controller(
  'v1/organizations/:organizationId/audit-logs',
)
@UseGuards(
  TenantMembershipGuard,
  PermissionGuard,
)
export class AuditController {
  constructor(
    private readonly audit:
      AuditService,
  ) {}

  @ApiResult('AuditLogs')
  @Get()
  @RequirePermissions(
    PERMISSIONS.AUDIT_LOGS_READ,
  )
  async list(
    @Req()
    request:
      TenantAuthenticatedRequest,

    @Query()
    query:
      ListAuditLogsDto,
  ) {
    const tenant =
      request.tenant;

    if (
      !tenant
    ) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.audit.list(
      tenant.organizationId,
      query,
    );
  }
}