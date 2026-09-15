import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { UsersService } from '../users/users.service.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@Controller('v1/invitations')
export class InvitationAcceptanceController {
  constructor(
    private readonly invitationsService:
      InvitationsService,

    private readonly usersService:
      UsersService,
  ) {}

  @Post('accept')
  @HttpCode(200)
  async accept(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    dto: AcceptInvitationDto,
  ) {
    const user =
      await this.usersService
        .syncAuthenticatedUser(
          request,
        );

    return this.invitationsService.accept(
      {
        id: user.id,
        email: user.email,
      },
      dto.token,
    );
  }
}