import {
  Controller,
  Get,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JWTPayload } from 'jose';

type AuthenticatedRequest = Request & {
  auth: JWTPayload;
};

@Controller('auth')
export class AuthController {
  @Get('check')
  check(@Req() request: AuthenticatedRequest) {
    return {
      authenticated: true,
      subject: request.auth.sub,
    };
  }
}