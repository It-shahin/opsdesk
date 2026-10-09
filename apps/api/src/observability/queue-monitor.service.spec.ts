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
import type { JobsService } from '../jobs/jobs.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { QueueMonitorService } from './queue-monitor.service.js';
import {
  HEARTBEAT_TTL_MS,
  MONITOR_TIMEOUT_MS,
} from './queue-monitoring.constants.js';

describe('Queue monitoring', () => {
  const getQueueSnapshot = jest.fn<JobsService['getQueueSnapshot']>();
  const zcount =
    jest.fn<(key: string, min: number, max: string) => Promise<number>>();
  const client = { status: 'ready', zcount };
  let service: QueueMonitorService;
  let log: { mock: { calls: unknown[][] } };
  let warn: { mock: { calls: unknown[][] } };
  let error: { mock: { calls: unknown[][] } };

  beforeEach(() => {
    jest.resetAllMocks();
    client.status = 'ready';
    getQueueSnapshot.mockResolvedValue({
      counts: { waiting: 0, active: 0, delayed: 1, failed: 0 },
      paused: false,
    });
    zcount.mockResolvedValue(1);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    service = new QueueMonitorService(
      new ConfigService({ NODE_ENV: 'test' }),
      { getQueueSnapshot } as unknown as JobsService,
      { getClient: () => client } as unknown as RedisService,
    );
  });
  afterEach(() => {
    service.onModuleDestroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('reports healthy idle queues without treating scheduled delayed jobs as a backlog', async () => {
    await service.sample();
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(log.mock.calls[0]![0]))).toMatchObject({
      event: 'queue.health',
      queue: 'email',
      status: 'up',
      backlog: 0,
      workersAlive: 1,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('counts only fresh heartbeats and reports missing consumers even with an empty queue', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(100_000);
    zcount.mockResolvedValue(0);
    await service.sample();
    expect(zcount).toHaveBeenCalledWith(
      'opsdesk:observability:workers:email',
      100_000 - HEARTBEAT_TTL_MS,
      '+inf',
    );
    expect(JSON.parse(String(warn.mock.calls[0]![0]))).toMatchObject({
      status: 'down',
      workersAlive: 0,
    });
  });

  it.each<Awaited<ReturnType<JobsService['getQueueSnapshot']>>>([
    { counts: { failed: 1 }, paused: false },
    { counts: { waiting: 100 }, paused: false },
    { counts: { waiting: 0 }, paused: true },
  ])('warns for failures, backlogs or paused queues: %j', async (snapshot) => {
    getQueueSnapshot.mockResolvedValue(snapshot);
    await service.sample();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(warn.mock.calls[0]![0])).status).toBe('degraded');
  });

  it('does not enqueue probes while Redis is disconnected', async () => {
    client.status = 'reconnecting';
    await service.sample();
    expect(getQueueSnapshot).not.toHaveBeenCalled();
    expect(zcount).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('redacts dependency error messages', async () => {
    getQueueSnapshot.mockRejectedValue(
      new Error('redis://private:SECRET@host PRIVATE_CUSTOMER'),
    );
    await service.sample();
    expect(error).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(error.mock.calls)).not.toMatch(
      /SECRET|PRIVATE_CUSTOMER/,
    );
  });

  it('bounds hung probes, prevents overlapping samples and permits a later retry', async () => {
    jest.useFakeTimers();
    getQueueSnapshot.mockImplementation(() => new Promise(() => {}));
    const pending = service.sample();
    await service.sample();
    expect(getQueueSnapshot).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(MONITOR_TIMEOUT_MS);
    await pending;
    expect(error).toHaveBeenCalledTimes(2);
    getQueueSnapshot.mockResolvedValue({ counts: {}, paused: false });
    await service.sample();
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('does not start background monitoring in the test environment', () => {
    const interval = jest.spyOn(globalThis, 'setInterval');
    service.onApplicationBootstrap();
    expect(interval).not.toHaveBeenCalled();
  });
});
