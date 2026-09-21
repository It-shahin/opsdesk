import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { UpdateTicketAssigneeDto } from './dto/update-ticket-assignee.dto.js';

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

    @Get(':ticketId')
    @RequirePermissions(
    PERMISSIONS.TICKETS_READ,
    )
    async getOne(
    @Req()
    request:
        TenantAuthenticatedRequest,

    @Param(
        'ticketId',
        new ParseUUIDPipe(),
    )
    ticketId: string,
    ) {
    const tenant =
        request.tenant;

    if (!tenant) {
        throw new ForbiddenException(
        'Tenant context is required',
        );
    }

    return this.ticketsService.findOne(
        tenant.organizationId,
        ticketId,
    );
}

@Patch(':ticketId')
@RequirePermissions(
  PERMISSIONS.TICKETS_WRITE,
)
async update(
  @Req()
  request:
    TenantAuthenticatedRequest,

  @Param(
    'ticketId',
    new ParseUUIDPipe(),
  )
  ticketId: string,

  @Body()
  dto: UpdateTicketDto,
) {
  const tenant =
    request.tenant;

  if (!tenant) {
    throw new ForbiddenException(
      'Tenant context is required',
    );
  }

  return this.ticketsService.update(
    tenant,
    ticketId,
    dto,
  );
}

@Patch(':ticketId/status')
@RequirePermissions(
  PERMISSIONS.TICKETS_WRITE,
)
async updateStatus(
  @Req()
  request:
    TenantAuthenticatedRequest,

  @Param(
    'ticketId',
    new ParseUUIDPipe(),
  )
  ticketId: string,

  @Body()
  dto:
    UpdateTicketStatusDto,
) {
  const tenant =
    request.tenant;

  if (!tenant) {
    throw new ForbiddenException(
      'Tenant context is required',
    );
  }

  return this.ticketsService
    .updateStatus(
      tenant,
      ticketId,
      dto.status,
    );
}

@Patch(':ticketId/assignee')
@RequirePermissions(
  PERMISSIONS.TICKETS_WRITE,
)
async assign(
  @Req()
  request:
    TenantAuthenticatedRequest,

  @Param(
    'ticketId',
    new ParseUUIDPipe(),
  )
  ticketId: string,

  @Body()
  dto:
    UpdateTicketAssigneeDto,
) {
  const tenant =
    request.tenant;

  if (!tenant) {
    throw new ForbiddenException(
      'Tenant context is required',
    );
  }

  return this.ticketsService.assign(
    tenant,
    ticketId,
    dto.membershipId,
  );
}
}