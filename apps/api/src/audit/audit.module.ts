import {
  Module,
} from '@nestjs/common';

import {
  RbacModule,
} from '../rbac/rbac.module.js';

import {
  TenancyModule,
} from '../tenancy/tenancy.module.js';

import {
  AuditController,
} from './audit.controller.js';

import {
  AuditService,
} from './audit.service.js';

@Module({
  imports: [
    TenancyModule,
    RbacModule,
  ],

  controllers: [
    AuditController,
  ],

  providers: [
    AuditService,
  ],

  exports: [
    AuditService,
  ],
})
export class AuditModule {}