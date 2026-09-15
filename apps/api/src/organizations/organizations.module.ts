import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

@Module({
  imports: [
    UsersModule,
    MembershipsModule,
    TenancyModule,
    RbacModule
],
  controllers: [
    OrganizationsController,
  ],
  providers: [
    OrganizationsService,
  ],
  exports: [
    OrganizationsService,
  ],
})
export class OrganizationsModule {}