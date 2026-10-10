import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { EmailWorker } from '../jobs/email.worker.js';
import type { MaintenanceWorker } from '../jobs/maintenance.worker.js';
import type { RedisService } from '../redis/redis.service.js';
import { WorkerHeartbeatService } from './worker-heartbeat.service.js';
import { HEARTBEAT_TTL_MS } from './queue-monitoring.constants.js';

describe('Worker heartbeats', () => {
  const exec = jest.fn<() => Promise<[Error | null, unknown][] | null>>();
  const transaction = {
    zadd: jest.fn<
      (key: string, timestamp: number, workerId: string) => unknown
    >(),
    zremrangebyscore: jest.fn(),
    expire: jest.fn(),
    zrem: jest.fn(),
    exec,
  };
  const remove = jest.fn<(key: string, workerId: string) => Promise<number>>();
  const client = { status: 'ready', multi: () => transaction, zrem: remove };
  const email = { isHealthy: jest.fn<() => boolean>() };
  const maintenance = { isHealthy: jest.fn<() => boolean>() };
  const redis = { getClient: () => client } as unknown as RedisService;
  const makeService = () =>
    new WorkerHeartbeatService(
      new ConfigService({ NODE_ENV: 'test' }),
      redis,
      email as unknown as EmailWorker,
      maintenance as unknown as MaintenanceWorker,
    );
  let service: WorkerHeartbeatService;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    client.status = 'ready';
    exec.mockResolvedValue([[null, 1]]);
    remove.mockResolvedValue(1);
    email.isHealthy.mockReturnValue(true);
    maintenance.isHealthy.mockReturnValue(true);
    service = makeService();
  });
  afterEach(async () => {
    await service.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('refreshes expiring per-queue heartbeats and prunes old members atomically', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(100_000);
    await service.publish();
    expect(transaction.zadd).toHaveBeenCalledTimes(2);
    expect(transaction.zremrangebyscore).toHaveBeenCalledWith(
      'opsdesk:observability:workers:email',
      '-inf',
      100_000 - HEARTBEAT_TTL_MS,
    );
    expect(transaction.expire).toHaveBeenCalledWith(
      'opsdesk:observability:workers:email',
      75,
    );
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('removes its heartbeat for paused, stopped or disconnected consumers', async () => {
    email.isHealthy.mockReturnValue(false);
    await service.publish();
    expect(transaction.zrem).toHaveBeenCalledWith(
      'opsdesk:observability:workers:email',
      expect.any(String),
    );
    expect(transaction.zadd).toHaveBeenCalledTimes(1);
    expect(transaction.zadd.mock.calls[0]![0]).toBe(
      'opsdesk:observability:workers:maintenance',
    );
  });

  it('keeps independent IDs for replicas and removes only its own membership on shutdown', async () => {
    await service.publish();
    const firstId = transaction.zadd.mock.calls[0]![2];
    const other = makeService();
    await other.publish();
    const otherId = transaction.zadd.mock.calls[2]![2];
    expect(firstId).not.toBe(otherId);
    await service.onModuleDestroy();
    expect(remove).toHaveBeenCalledWith(
      'opsdesk:observability:workers:email',
      firstId,
    );
    expect(remove).not.toHaveBeenCalledWith(
      'opsdesk:observability:workers:email',
      otherId,
    );
    transaction.zadd.mockClear();
    await service.publish();
    expect(transaction.zadd).not.toHaveBeenCalled();
    await other.onModuleDestroy();
  });

  it('redacts Redis errors and detects transaction command failures', async () => {
    exec.mockResolvedValue([[new Error('redis://password@private'), null]]);
    await service.publish();
    const error = jest.mocked(Logger.prototype.error);
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).not.toContain('password');
    expect(JSON.parse(String(error.mock.calls[0]![0])).event).toBe(
      'worker.heartbeat.failed',
    );
  });

  it('does not write while Redis is disconnected', async () => {
    client.status = 'reconnecting';
    await service.publish();
    expect(exec).not.toHaveBeenCalled();
  });

  it('does not create heartbeat timers in the test environment', async () => {
    const interval = jest.spyOn(globalThis, 'setInterval');
    await service.onApplicationBootstrap();
    expect(exec).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
  });
});
