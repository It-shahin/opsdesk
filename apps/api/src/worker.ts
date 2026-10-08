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

  let shuttingDown =
    false;

  const shutdown =
    async (
      signal:
        string,
    ) => {
      if (
        shuttingDown
      ) {
        return;
      }

      shuttingDown =
        true;

      logger.log(
        `Received ${signal}; shutting down worker`,
      );

      try {
        await app.close();

        logger.log(
          'Worker shutdown completed',
        );

        process.exitCode =
          0;
      } catch (
        error
      ) {
        logger.error(
          'Worker shutdown failed',

          error instanceof
            Error
            ? error.stack
            : undefined,
        );

        process.exitCode =
          1;
      }
    };

  process.once(
    'SIGTERM',
    () =>
      void shutdown(
        'SIGTERM',
      ),
  );

  process.once(
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

void bootstrap()
  .catch(
    (
      error:
        unknown,
    ) => {
      const logger =
        new Logger(
          'WorkerBootstrap',
        );

      logger.error(
        'OpsDesk worker failed to start',

        error instanceof
          Error
          ? error.stack
          : undefined,
      );

      process.exit(
        1,
      );
    },
  );