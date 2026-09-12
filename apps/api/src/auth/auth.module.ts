import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { Auth0UserInfoService } from './auth0-userinfo.service.js';
import { AuthGuard } from './auth.guard.js';

@Module({
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