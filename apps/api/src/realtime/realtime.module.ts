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
  RealtimePublisherModule,
} from './realtime-publisher.module.js';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TenancyModule,
    RbacModule,
    TicketsModule,
    RealtimePublisherModule
  ],

  providers: [
    RealtimeGateway,
  ],

  exports: [
    RealtimeGateway,
  ],
})
export class RealtimeModule {}