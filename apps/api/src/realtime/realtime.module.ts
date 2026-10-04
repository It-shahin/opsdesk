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

import {
  RbacModule,
} from '../rbac/rbac.module.js';

import {
  TicketsModule,
} from '../tickets/tickets.module.js';

import {
  RealtimeRedisAdapterService,
} from './realtime-redis-adapter.service.js';

import {
  RedisModule,
} from '../redis/redis.module.js';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TenancyModule,
    RbacModule,
    TicketsModule,
    RedisModule,
  ],

  providers: [
    RealtimeGateway,
    RealtimeRedisAdapterService,
  ],

  exports: [
    RealtimeGateway,
  ],
})
export class RealtimeModule {}
