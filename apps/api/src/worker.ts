import {
  Logger,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import {
  WorkerModule,
} from './worker.module.js';

async function bootstrap() {
  const logger =
    new Logger(
      'WorkerBootstrap',
    );

  const app =
    await NestFactory
      .createApplicationContext(
        WorkerModule,
        {
          logger: [
            'log',
            'error',
            'warn',
          ],
        },
      );

  const shutdown =
    async (
      signal:
        string,
    ) => {
      logger.log(
        `Received ${signal}`,
      );

      await app.close();

      process.exit(
        0,
      );
    };

  process.on(
    'SIGTERM',
    () =>
      void shutdown(
        'SIGTERM',
      ),
  );

  process.on(
    'SIGINT',
    () =>
      void shutdown(
        'SIGINT',
      ),
  );

  logger.log(
    'OpsDesk worker is running',
  );
}

void bootstrap();