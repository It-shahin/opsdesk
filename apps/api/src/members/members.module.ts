import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { UsersModule } from '../users/users.module.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';

@Module({
  imports: [
    TenancyModule,
    RbacModule,
    UsersModule,
  ],
  controllers: [
    MembersController,
  ],
  providers: [
    MembersService,
  ],
  exports: [
    MembersService,
  ],
})
export class MembersModule {}
