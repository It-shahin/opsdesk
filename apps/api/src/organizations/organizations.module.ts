import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { MembershipsModule } from '../memberships/memberships.module.js';

@Module({
  imports: [
    UsersModule,
    MembershipsModule
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