import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.validation.js';

import {
  DatabaseModule,
} from './database/database.module.js';

import {
  EmailModule,
} from './email/email.module.js';

import {
  EmailWorker,
} from './jobs/email.worker.js';

import {
  JobsModule,
} from './jobs/jobs.module.js';

import {
  RealtimePublisherModule,
} from './realtime/realtime-publisher.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      envFilePath: ['apps/api/.env', '.env'],

      validate: validateEnv,
    }),
    DatabaseModule,

    EmailModule,

    JobsModule,

    RealtimePublisherModule,
  ],

  providers: [EmailWorker],
})
export class WorkerModule {}
