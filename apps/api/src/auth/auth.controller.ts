import {
  Controller,
  Get,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types.js';

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