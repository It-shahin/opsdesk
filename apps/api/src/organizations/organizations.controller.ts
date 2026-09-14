import {
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { UsersService } from '../users/users.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('v1/organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService:
      OrganizationsService,
    private readonly usersService:
      UsersService,
  ) {}

  @Post()
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
}