import { ApiResource, ApiResult } from '../openapi/api-documentation.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PermissionGuard } from '../rbac/permission.guard.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { RequirePermissions } from '../rbac/require-permissions.decorator.js';
import { TenantMembershipGuard } from '../tenancy/tenant-membership.guard.js';
import type { TenantAuthenticatedRequest } from '../tenancy/tenant-context.types.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { ListCustomersDto } from './dto/list-customers.dto.js';
import { CustomersService } from './customers.service.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

import {
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';

@ApiResource('Customers')
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

  @ApiResult('Customers')
  @Get()
  @RequirePermissions(
    PERMISSIONS.CUSTOMERS_READ,
  )
  async list(
    @Req()
    request: TenantAuthenticatedRequest,

    @Query()
    query: ListCustomersDto,
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
      query,
    );
  }

  @ApiResult('Customer')
  @Get(':customerId')
@RequirePermissions(
  PERMISSIONS.CUSTOMERS_READ,
)
async getOne(
  @Req()
  request: TenantAuthenticatedRequest,

  @Param(
    'customerId',
    new ParseUUIDPipe(),
  )
  customerId: string,
) {
  const tenant =
    request.tenant;

  if (!tenant) {
    throw new ForbiddenException(
      'Tenant context is required',
    );
  }

  return this.customersService.findOne(
    tenant.organizationId,
    customerId,
  );
}

  @ApiResult('Customer')
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

  @ApiResult('Customer')
  @Patch(':customerId')
  @RequirePermissions(
    PERMISSIONS.CUSTOMERS_WRITE,
  )
  async update(
    @Req()
    request: TenantAuthenticatedRequest,

    @Param(
      'customerId',
      new ParseUUIDPipe(),
    )
    customerId: string,

    @Body()
    dto: UpdateCustomerDto,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.customersService.update(
      tenant,
      customerId,
      dto,
    );
}

@ApiResult('Customer')
  @Post(':customerId/restore')
@HttpCode(200)
@RequirePermissions(
  PERMISSIONS.CUSTOMERS_WRITE,
)
async restore(
  @Req()
  request: TenantAuthenticatedRequest,

  @Param(
    'customerId',
    new ParseUUIDPipe(),
  )
  customerId: string,
) {
  const tenant =
    request.tenant;

  if (!tenant) {
    throw new ForbiddenException(
      'Tenant context is required',
    );
  }

  return this.customersService.restore(
    tenant,
    customerId,
  );
}

@ApiResult('Customer')
  @Post(':customerId/archive')
@HttpCode(200)
@RequirePermissions(
  PERMISSIONS.CUSTOMERS_WRITE,
)
async archive(
  @Req()
  request: TenantAuthenticatedRequest,

  @Param(
    'customerId',
    new ParseUUIDPipe(),
  )
  customerId: string,
) {
  const tenant =
    request.tenant;

  if (!tenant) {
    throw new ForbiddenException(
      'Tenant context is required',
    );
  }

  return this.customersService.archive(
    tenant,
    customerId,
  );
}
}
