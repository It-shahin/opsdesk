import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
