import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

@Module({
  imports: [
    TenancyModule,
    RbacModule,
  ],

  controllers: [
    TagsController,
  ],

  providers: [
    TagsService,
  ],

  exports: [
    TagsService,
  ],
})
export class TagsModule {}