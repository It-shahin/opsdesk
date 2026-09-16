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
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { CustomersService } from './customers.service.js';

@Controller(
  'v1/organizations/:organizationId/customers',
)
@UseGuards(
  TenantMembershipGuard,
  PermissionGuard,
)
export class CustomersController {
  constructor(
    private readonly customersService:
      CustomersService,
  ) {}

  @Get()
  @RequirePermissions(
    PERMISSIONS.CUSTOMERS_READ,
  )
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

    return this.customersService.list(
      tenant.organizationId,
    );
  }

  @Post()
  @RequirePermissions(
    PERMISSIONS.CUSTOMERS_WRITE,
  )
  async create(
    @Req()
    request: TenantAuthenticatedRequest,

    @Body()
    dto: CreateCustomerDto,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.customersService.create(
      tenant,
      dto,
    );
  }
}