import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { QueueMonitorService } from './queue-monitor.service.js';

@Module({
  imports: [JobsModule, RedisModule],
  providers: [QueueMonitorService],
})
export class QueueMonitoringModule {}
