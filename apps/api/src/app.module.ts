import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { validateEnv } from './config/env.validation.js';
import { AuthModule } from './auth/auth.module.js'
import { UsersModule } from './users/users.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { MembershipsModule } from './memberships/memberships.module.js';

@Module({
  imports: [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['apps/api/.env', '.env'],
    validate: validateEnv,
  }),

  DatabaseModule,
  RedisModule,
  AuthModule,
  AuthModule,
  UsersModule,
  OrganizationsModule,
  MembershipsModule
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}