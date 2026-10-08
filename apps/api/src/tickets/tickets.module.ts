import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';
import { RealtimePublisherModule } from '../realtime/realtime-publisher.module.js';

@Module({
  imports: [
    TenancyModule,
    RbacModule,
    AuditModule,
    RealtimePublisherModule,
  ],

  controllers: [
    TicketsController,
  ],

  providers: [
    TicketsService,
  ],

  exports: [
    TicketsService,
  ],
})
export class TicketsModule {}
