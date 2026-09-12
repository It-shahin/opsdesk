import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { Auth0UserInfoService } from './auth0-userinfo.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    Auth0UserInfoService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [Auth0UserInfoService],
})
export class AuthModule {}