import { Module } from '@nestjs/common';

import { MembershipsModule } from '../memberships/memberships.module.js';
import { UsersModule } from '../users/users.module.js';
import { TenantContextService } from './tenant-context.service.js';
import { TenantMembershipGuard } from './tenant-membership.guard.js';

@Module({
  imports: [
    MembershipsModule,
    UsersModule,
  ],
  providers: [
    TenantContextService,
    TenantMembershipGuard,
  ],
  exports: [
    UsersModule,
    TenantContextService,
    TenantMembershipGuard,
  ],
})
export class TenancyModule {}
