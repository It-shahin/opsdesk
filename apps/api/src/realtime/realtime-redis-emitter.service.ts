import {
  Injectable,
} from '@nestjs/common';

import {
  Emitter,
} from '@socket.io/redis-emitter';

import {
  RedisService,
} from '../redis/redis.service.js';

import {
  REALTIME_NAMESPACE,
  REALTIME_REDIS_KEY,
} from './realtime.constants.js';

import type {
  ServerToClientEvents,
} from './realtime.types.js';

@Injectable()
export class RealtimeRedisEmitterService {
  private readonly emitter:
    Emitter<
      ServerToClientEvents
    >;

  constructor(
    redis:
      RedisService,
  ) {
    this.emitter =
      new Emitter<
        ServerToClientEvents
      >(
        redis.getClient(),
        {
          key:
            REALTIME_REDIS_KEY,
        },
      )
        .of(
          REALTIME_NAMESPACE,
        );
  }

  getEmitter() {
    return this.emitter;
  }
}