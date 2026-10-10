import { ApiResource, ApiResult } from '../openapi/api-documentation.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { minutes, Throttle } from '@nestjs/throttler';

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
  AttachmentsService,
} from './attachments.service.js';

import {
  InitiateAttachmentUploadDto,
} from './dto/initiate-attachment-upload.dto.js';

@ApiResource('Attachments')
@Controller(
  'v1/organizations/:organizationId/tickets/:ticketId/attachments',
)
@UseGuards(
  TenantMembershipGuard,
  PermissionGuard,
)
export class AttachmentsController {
  constructor(
    private readonly attachmentsService:
      AttachmentsService,
  ) {}

  @ApiResult('InitiatedAttachment')
  @Post('init')
  @HttpCode(200)
  @Throttle({
    default: {
      limit: 30,
      ttl: minutes(1),
    },
  })
  @RequirePermissions(
    PERMISSIONS.TICKETS_WRITE,
  )
  async initiate(
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
      InitiateAttachmentUploadDto,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.attachmentsService
      .initiateUpload(
        tenant,
        ticketId,
        dto,
      );
  }

  @ApiResult('Attachment')
  @Post(
    ':attachmentId/complete',
  )
  @Throttle({
    default: {
      limit: 60,
      ttl: minutes(1),
    },
  })
  @HttpCode(200)
  @RequirePermissions(
    PERMISSIONS.TICKETS_WRITE,
  )
  async complete(
    @Req()
    request:
      TenantAuthenticatedRequest,

    @Param(
      'ticketId',
      new ParseUUIDPipe(),
    )
    ticketId: string,

    @Param(
      'attachmentId',
      new ParseUUIDPipe(),
    )
    attachmentId: string,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.attachmentsService
      .completeUpload(
        tenant,
        ticketId,
        attachmentId,
      );
  }

  @ApiResult('Download')
  @Get(':attachmentId/download')
  @RequirePermissions(
    PERMISSIONS.TICKETS_READ,
  )
  async download(
    @Req()
    request:
      TenantAuthenticatedRequest,

    @Param(
      'ticketId',
      new ParseUUIDPipe(),
    )
    ticketId: string,

    @Param(
      'attachmentId',
      new ParseUUIDPipe(),
    )
    attachmentId: string,
  ) {
    const tenant =
      request.tenant;

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant context is required',
      );
    }

    return this.attachmentsService
      .createDownloadUrl(
        tenant,
        ticketId,
        attachmentId,
      );
  }
}
