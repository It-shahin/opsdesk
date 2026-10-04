import {
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';

import {
  createAdapter,
} from '@socket.io/redis-adapter';

import type Redis from 'ioredis';

import {
  RedisService,
} from '../redis/redis.service.js';

import {
  REALTIME_REDIS_KEY,
} from './realtime.constants.js';

@Injectable()
export class RealtimeRedisAdapterService
  implements OnApplicationShutdown
{
  private readonly logger =
    new Logger(
      RealtimeRedisAdapterService.name,
    );

  private readonly pubClient:
    Redis;

  private readonly subClient:
    Redis;

  private connected =
    false;

  constructor(
    redis:
      RedisService,
  ) {
    const base =
      redis.getClient();

    /*
     * Never turn the normal Redis
     * command client into a subscriber.
     *
     * Redis subscriber connections
     * are dedicated connections.
     */
    this.pubClient =
      base.duplicate({
        lazyConnect:
          true,

        maxRetriesPerRequest:
          null,
      });

    this.subClient =
      base.duplicate({
        lazyConnect:
          true,

        maxRetriesPerRequest:
          null,
      });

    this.pubClient.on(
      'error',
      (
        error,
      ) => {
        this.logger.error(
          `Realtime Redis publisher error: ${error.message}`,
        );
      },
    );

    this.subClient.on(
      'error',
      (
        error,
      ) => {
        this.logger.error(
          `Realtime Redis subscriber error: ${error.message}`,
        );
      },
    );
  }

  async connect() {
    if (
      this.connected
    ) {
      return;
    }

    await Promise.all([
      this.pubClient.connect(),
      this.subClient.connect(),
    ]);

    this.connected =
      true;

    this.logger.log(
      'Socket.IO Redis adapter connected',
    );
  }

  getAdapter() {
    if (
      !this.connected
    ) {
      throw new Error(
        'Realtime Redis adapter is not connected',
      );
    }

    return createAdapter(
      this.pubClient,
      this.subClient,
      {
        key:
          REALTIME_REDIS_KEY,

        /*
         * More efficient for
         * inter-server request replies.
         */
        publishOnSpecificResponseChannel:
          true,
      },
    );
  }

  // Nest disposes Socket.IO before this hook, so the adapter can unsubscribe
  // while its dedicated Redis connections are still open.
  async onApplicationShutdown() {
    if (
      !this.connected
    ) {
      this.pubClient.disconnect();
      this.subClient.disconnect();

      return;
    }

    await Promise.allSettled([
      this.pubClient.quit(),
      this.subClient.quit(),
    ]);

    this.connected =
      false;
  }
}
