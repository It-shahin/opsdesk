import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  RedisService,
} from '../redis/redis.service.js';

type DependencyStatus = {
  status:
    'up' | 'down';

  latencyMs:
    number;
};

@Injectable()
export class HealthService {
  private readonly timeoutMs =
    2_000;

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly redis:
      RedisService,
  ) {}

  liveness() {
    return {
      status:
        'ok',

      uptimeSeconds:
        Math.floor(
          process.uptime(),
        ),
    };
  }

  async readiness() {
    const [
      database,
      redis,
    ] =
      await Promise.all([
        this.probe(
          async () => {
            await this.prisma
              .$queryRaw`
                SELECT 1
              `;
          },
        ),

        this.probe(
          async () => {
            const result =
              await this.redis
                .ping();

            if (
              result !==
              'PONG'
            ) {
              throw new Error(
                'Redis ping failed',
              );
            }
          },
        ),
      ]);

    const services = {
      database,
      redis,
    };

    if (
      database.status ===
        'down' ||
      redis.status ===
        'down'
    ) {
      throw new ServiceUnavailableException({
        status:
          'not_ready',

        services,
      });
    }

    return {
      status:
        'ready',

      services,
    };
  }

  private async probe(
    operation:
      () =>
        Promise<void>,
  ): Promise<
    DependencyStatus
  > {
    const startedAt =
      Date.now();

    let timeout:
      NodeJS.Timeout |
      undefined;

    try {
      await Promise.race([
        operation(),

        new Promise<never>(
          (
            _resolve,
            reject,
          ) => {
            timeout =
              setTimeout(
                () => {
                  reject(
                    new Error(
                      'Health probe timed out',
                    ),
                  );
                },

                this.timeoutMs,
              );
          },
        ),
      ]);

      return {
        status:
          'up',

        latencyMs:
          Date.now() -
          startedAt,
      };
    } catch {
      return {
        status:
          'down',

        latencyMs:
          Date.now() -
          startedAt,
      };
    } finally {
      if (
        timeout
      ) {
        clearTimeout(
          timeout,
        );
      }
    }
  }
}