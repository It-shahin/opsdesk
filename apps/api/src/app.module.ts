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
import { TenancyModule } from './tenancy/tenancy.module.js';
import { RbacModule } from './rbac/rbac.module.js';
import { MembersModule } from './members/members.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { TicketsModule } from './tickets/tickets.module.js';

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
  MembershipsModule,
  TenancyModule,
  RbacModule,
  MembersModule,
  InvitationsModule,
  CustomersModule,
  TicketsModule,
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}