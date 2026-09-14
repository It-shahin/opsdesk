import { Module } from '@nestjs/common';

import { MembershipsModule } from '../memberships/memberships.module.js';
import { TenantContextService } from './tenant-context.service.js';

@Module({
  imports: [
    MembershipsModule,
  ],
  providers: [
    TenantContextService,
  ],
  exports: [
    TenantContextService,
  ],
})
export class TenancyModule {}