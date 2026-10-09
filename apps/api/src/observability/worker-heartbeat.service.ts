import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { EmailWorker } from '../jobs/email.worker.js';
import { MaintenanceWorker } from '../jobs/maintenance.worker.js';
import { QUEUE_NAMES } from '../jobs/jobs.constants.js';
import { RedisService } from '../redis/redis.service.js';
import {
  bounded,
  heartbeatKey,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TTL_MS,
  MONITORED_QUEUES,
} from './queue-monitoring.constants.js';

@Injectable()
export class WorkerHeartbeatService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger('WorkerHeartbeat');
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly email: EmailWorker,
    private readonly maintenance: MaintenanceWorker,
  ) {}

  async onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    await this.publish();
    this.timer = setInterval(() => void this.publish(), HEARTBEAT_INTERVAL_MS);
    this.timer.unref();
  }

  publish(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.writeHeartbeat().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async writeHeartbeat(): Promise<void> {
    try {
      const client = this.redis.getClient();
      if (client.status !== 'ready') throw new Error('Redis unavailable');
      const now = Date.now();
      const states = MONITORED_QUEUES.map((queue) => ({
        queue,
        healthy:
          queue === QUEUE_NAMES.EMAIL
            ? this.email.isHealthy()
            : this.maintenance.isHealthy(),
      }));
      const transaction = client.multi();
      for (const { queue, healthy } of states) {
        const key = heartbeatKey(queue);
        if (healthy) {
          transaction.zadd(key, now, this.workerId);
          transaction.zremrangebyscore(key, '-inf', now - HEARTBEAT_TTL_MS);
          transaction.expire(key, HEARTBEAT_TTL_MS / 1_000);
        } else {
          transaction.zrem(key, this.workerId);
        }
      }
      const result = await bounded(transaction.exec());
      if (!result || result.some(([error]) => error))
        throw new Error('Heartbeat write failed');
      const event = JSON.stringify({
        event: 'worker.heartbeat',
        workerId: this.workerId,
        queues: states,
      });
      if (states.every(({ healthy }) => healthy)) this.logger.log(event);
      else this.logger.warn(event);
    } catch {
      this.logger.error(
        JSON.stringify({
          event: 'worker.heartbeat.failed',
          workerId: this.workerId,
        }),
      );
    }
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
    try {
      const client = this.redis.getClient();
      if (client.status !== 'ready') return;
      await bounded(
        Promise.all(
          MONITORED_QUEUES.map((queue) =>
            client.zrem(heartbeatKey(queue), this.workerId),
          ),
        ),
      );
    } catch {
      // A crashed or disconnected worker is removed by heartbeat expiry.
    }
  }
}
