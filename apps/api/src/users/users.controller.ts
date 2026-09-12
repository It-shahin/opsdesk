import {
  Controller,
  Get,
  Req,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { UsersService } from './users.service.js';

@Controller('v1')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  async getCurrentUser(
    @Req() request: AuthenticatedRequest,
  ) {
    const user =
      await this.usersService.syncAuthenticatedUser(
        request,
      );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}