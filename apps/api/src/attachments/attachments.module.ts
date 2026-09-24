import {
  Module,
} from '@nestjs/common';

import {
  RbacModule,
} from '../rbac/rbac.module.js';

import {
  StorageModule,
} from '../storage/storage.module.js';

import {
  TenancyModule,
} from '../tenancy/tenancy.module.js';

import {
  AttachmentsController,
} from './attachments.controller.js';

import {
  AttachmentsService,
} from './attachments.service.js';

@Module({
  imports: [
    TenancyModule,
    RbacModule,
    StorageModule,
  ],

  controllers: [
    AttachmentsController,
  ],

  providers: [
    AttachmentsService,
  ],

  exports: [
    AttachmentsService,
  ],
})
export class AttachmentsModule {}