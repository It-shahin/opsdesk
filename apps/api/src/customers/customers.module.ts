import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [
    TenancyModule,
    RbacModule,
    AuditModule,
  ],

  controllers: [
    CustomersController,
  ],

  providers: [
    CustomersService,
  ],

  exports: [
    CustomersService,
  ],
})
export class CustomersModule {}
