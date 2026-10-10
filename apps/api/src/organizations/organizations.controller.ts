import { ApiResource, ApiResult } from '../openapi/api-documentation.js';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { minutes, Throttle } from '@nestjs/throttler';

import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { TenantMembershipGuard } from '../tenancy/tenant-membership.guard.js';
import type { TenantAuthenticatedRequest } from '../tenancy/tenant-context.types.js';
import { UsersService } from '../users/users.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { OrganizationsService } from './organizations.service.js';

@ApiResource('Organizations')
@Controller('v1/organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly usersService: UsersService,
  ) {}

  @ApiResult('Organization')
  @Post()
  @Throttle({
    default: {
      limit: 5,
      ttl: minutes(10),
      blockDuration: minutes(10),
    },
  })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateOrganizationDto,
  ) {
    const user =
      await this.usersService.syncAuthenticatedUser(
        request,
      );

    return this.organizationsService.createForUser(
      user.id,
      dto.name,
    );
  }

  @ApiResult('Organizations')
  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
  ) {
    const user =
      await this.usersService.syncAuthenticatedUser(
        request,
      );

    return this.organizationsService.listForUser(
      user.id,
    );
  }

  @ApiResult('Organization')
  @Get(':organizationId')
  @UseGuards(TenantMembershipGuard)
  async getOne(
    @Req() request: TenantAuthenticatedRequest,
  ) {
    const tenant = request.tenant;

    if (!tenant) {
      throw new NotFoundException(
        'Organization not found',
      );
    }

    const organization =
      await this.organizationsService.findById(
        tenant.organizationId,
      );

    if (!organization) {
      throw new NotFoundException(
        'Organization not found',
      );
    }

    return {
      ...organization,
      role: tenant.role,
    };
  }
}
