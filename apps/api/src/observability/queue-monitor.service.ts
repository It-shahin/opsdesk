import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsService } from '../jobs/jobs.service.js';
import { RedisService } from '../redis/redis.service.js';
import {
  BACKLOG_WARNING_COUNT,
  bounded,
  heartbeatKey,
  HEARTBEAT_TTL_MS,
  MONITORED_QUEUES,
  QUEUE_SAMPLE_INTERVAL_MS,
} from './queue-monitoring.constants.js';

@Injectable()
export class QueueMonitorService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger('QueueHealth');
  private timer?: NodeJS.Timeout;
  private sampling = false;

  constructor(
    private readonly config: ConfigService,
    private readonly jobs: JobsService,
    private readonly redis: RedisService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    // Allow workers to bootstrap before the first sample.
    this.timer = setInterval(
      () => void this.sample(),
      QUEUE_SAMPLE_INTERVAL_MS,
    );
    this.timer.unref();
  }

  async sample(): Promise<void> {
    if (this.sampling) return;
    this.sampling = true;
    try {
      await Promise.all(
        MONITORED_QUEUES.map(async (queue) => {
          try {
            const client = this.redis.getClient();
            if (client.status !== 'ready') throw new Error('Redis unavailable');
            const [{ counts, paused }, workersAlive] = await bounded(
              Promise.all([
                this.jobs.getQueueSnapshot(queue),
                client.zcount(
                  heartbeatKey(queue),
                  Date.now() - HEARTBEAT_TTL_MS,
                  '+inf',
                ),
              ]),
            );
            const backlog = counts.waiting ?? 0;
            const status =
              workersAlive === 0
                ? 'down'
                : (counts.failed ?? 0) > 0 ||
                    paused ||
                    backlog >= BACKLOG_WARNING_COUNT
                  ? 'degraded'
                  : 'up';
            const event = JSON.stringify({
              event: 'queue.health',
              queue,
              status,
              counts,
              paused,
              backlog,
              workersAlive,
            });
            if (status === 'up') this.logger.log(event);
            else this.logger.warn(event);
          } catch {
            // Connection exceptions can contain passwords or private URLs.
            this.logger.error(
              JSON.stringify({
                event: 'queue.health',
                queue,
                status: 'down',
                reason: 'probe_failed',
              }),
            );
          }
        }),
      );
    } finally {
      this.sampling = false;
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
