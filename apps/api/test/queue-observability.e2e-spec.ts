import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import type { EmailWorker } from '../src/jobs/email.worker.js';
import type { MaintenanceWorker } from '../src/jobs/maintenance.worker.js';
import type { JobsService } from '../src/jobs/jobs.service.js';
import type { RedisService } from '../src/redis/redis.service.js';
import { QueueMonitorService } from '../src/observability/queue-monitor.service.js';
import { WorkerHeartbeatService } from '../src/observability/worker-heartbeat.service.js';
import {
  heartbeatKey,
  HEARTBEAT_TTL_MS,
} from '../src/observability/queue-monitoring.constants.js';

// Match the existing Redis-backed E2E suite convention. Prefix every command so
// the test cannot overwrite operational heartbeats on a shared development Redis.
const redisUrl = process.env.REDIS_URL;
(redisUrl ? describe : describe.skip)(
  'Queue heartbeat monitoring against Redis',
  () => {
    let client: Redis;
    let first: WorkerHeartbeatService;
    let second: WorkerHeartbeatService;
    let monitor: QueueMonitorService;
    const key = heartbeatKey('email');
    const email = { isHealthy: () => true } as EmailWorker;
    const maintenance = { isHealthy: () => true } as MaintenanceWorker;

    beforeAll(async () => {
      client = new Redis(redisUrl!, {
        keyPrefix: `opsdesk:test:heartbeat:${randomUUID()}:`,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        commandTimeout: 2_000,
      });
      await client.connect();
      const redis = { getClient: () => client } as unknown as RedisService;
      const config = new ConfigService({ NODE_ENV: 'test' });
      first = new WorkerHeartbeatService(config, redis, email, maintenance);
      second = new WorkerHeartbeatService(config, redis, email, maintenance);
      monitor = new QueueMonitorService(
        config,
        {
          getQueueSnapshot: async () => ({
            counts: { waiting: 0, failed: 0 },
            paused: false,
          }),
        } as unknown as JobsService,
        redis,
      );
    });
    afterAll(async () => {
      monitor?.onModuleDestroy();
      await first?.onModuleDestroy();
      await second?.onModuleDestroy();
      if (client) {
        await client.del(key, heartbeatKey('maintenance'));
        await client.quit();
      }
    });

    it('expires stale instances, counts replicas and removes only the stopped instance', async () => {
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});
      try {
        await client.zadd(
          key,
          Date.now() - HEARTBEAT_TTL_MS - 1_000,
          'crashed-worker',
        );
        await first.publish();
        await second.publish();
        expect(await client.zcard(key)).toBe(2);
        const ttl = await client.ttl(key);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(75);
        await monitor.sample();
        const events = log.mock.calls.map(
          ([message]) =>
            JSON.parse(String(message)) as {
              event: string;
              queue?: string;
              workersAlive?: number;
              status?: string;
            },
        );
        expect(
          events.find(
            (event) =>
              event.event === 'queue.health' && event.queue === 'email',
          ),
        ).toMatchObject({ workersAlive: 2, status: 'up' });
        await first.onModuleDestroy();
        expect(await client.zcard(key)).toBe(1);
        // Make the surviving replica stale without waiting 75 real seconds.
        const [member] = await client.zrange(key, '0', '-1');
        await client.zadd(key, Date.now() - HEARTBEAT_TTL_MS - 1_000, member!);
        await monitor.sample();
        const warnings = warn.mock.calls.map(
          ([message]) =>
            JSON.parse(String(message)) as {
              event: string;
              queue?: string;
              workersAlive?: number;
              status?: string;
            },
        );
        expect(warnings.find((event) => event.queue === 'email')).toMatchObject(
          { status: 'down', workersAlive: 0 },
        );
      } finally {
        log.mockRestore();
        warn.mockRestore();
      }
    });
  },
);
