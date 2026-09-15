import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { UsersModule } from '../users/users.module.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  imports: [
    TenancyModule,
    RbacModule,
    UsersModule,
  ],

  controllers: [
    InvitationsController,
  ],

  providers: [
    InvitationsService,
  ],

  exports: [
    InvitationsService,
  ],
})
export class InvitationsModule {}
