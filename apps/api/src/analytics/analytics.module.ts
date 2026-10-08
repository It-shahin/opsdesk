import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module.js';

import { TenancyModule } from '../tenancy/tenancy.module.js';

import { AnalyticsController } from './analytics.controller.js';

import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [TenancyModule, RbacModule],

  controllers: [AnalyticsController],

  providers: [AnalyticsService],

  exports: [AnalyticsService],
})
export class AnalyticsModule {}
