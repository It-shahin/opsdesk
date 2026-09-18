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
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { TicketsService } from './tickets.service.js';

@Controller(
  'v1/organizations/:organizationId/tickets',
)
@UseGuards(
  TenantMembershipGuard,
  PermissionGuard,
)
export class TicketsController {
  constructor(
    private readonly ticketsService:
      TicketsService,
  ) {}

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

    return this.ticketsService.list(
      tenant.organizationId,
    );
  }

  @Post()
  @RequirePermissions(
    PERMISSIONS.TICKETS_WRITE,
  )
  async create(
    @Req()
    request:
      TenantAuthenticatedRequest,

    @Body()
    dto: CreateTicketDto,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.ticketsService.create(
      tenant,
      dto,
    );
  }
}