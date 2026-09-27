import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.validation.js';

import { EmailWorker } from './jobs/email.worker.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      envFilePath: ['apps/api/.env', '.env'],

      validate: validateEnv,
    }),
  ],

  providers: [EmailWorker],
})
export class WorkerModule {}
