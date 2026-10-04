import {
  Module,
} from '@nestjs/common';

import {
  RealtimeService,
} from './realtime.service.js';

import {
  RedisModule,
} from '../redis/redis.module.js';

import {
  RealtimeRedisEmitterService,
} from './realtime-redis-emitter.service.js';

@Module({
  imports: [
    RedisModule,
  ],

  providers: [
    RealtimeRedisEmitterService,
    RealtimeService,
  ],

  exports: [
    RealtimeService,
  ],
})
export class RealtimePublisherModule {}