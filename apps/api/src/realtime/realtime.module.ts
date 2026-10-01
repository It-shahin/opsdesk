import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  TenancyModule,
} from '../tenancy/tenancy.module.js';

import {
  UsersModule,
} from '../users/users.module.js';

import {
  RealtimeGateway,
} from './realtime.gateway.js';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TenancyModule,
  ],

  providers: [
    RealtimeGateway,
  ],

  exports: [
    RealtimeGateway,
  ],
})
export class RealtimeModule {}