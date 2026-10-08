import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  EMAIL_JOB_NAMES,
  MAINTENANCE_JOB_NAMES,
  QUEUE_NAMES,
} from './jobs.constants.js';

const queues: TestQueue[] = [];
const connections: { quit: ReturnType<typeof jest.fn<() => Promise<void>>> }[] =
  [];
class TestQueue {
  upsertJobScheduler = jest
    .fn<(...args: unknown[]) => Promise<void>>()
    .mockResolvedValue(undefined);
  close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  constructor(
    readonly name: string,
    readonly options: { connection: unknown },
  ) {
    queues.push(this);
  }
}
jest.unstable_mockModule('bullmq', () => ({ Queue: TestQueue }));
jest.unstable_mockModule('./bullmq-connection.js', () => ({
  createQueueRedisConnection: () => {
    const connection = {
      quit: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    connections.push(connection);
    return connection;
  },
}));
const { JobsService } = await import('./jobs.service.js');

describe('JobsService schedulers and shutdown', () => {
  let service: InstanceType<typeof JobsService>;
  beforeEach(() => {
    queues.length = 0;
    connections.length = 0;
    service = new JobsService({
      getOrThrow: () => 'redis://localhost:6379',
    } as unknown as ConfigService);
  });
  it('registers recovery every minute and cleanup every fifteen minutes on separate queues', async () => {
    await service.onModuleInit();
    expect(queues.map((queue) => queue.name)).toEqual([
      QUEUE_NAMES.EMAIL,
      QUEUE_NAMES.MAINTENANCE,
    ]);
    expect(queues[0]!.options.connection).toBe(connections[0]);
    expect(queues[1]!.options.connection).toBe(connections[1]);
    expect(connections[0]).not.toBe(connections[1]);
    expect(queues[0]!.upsertJobScheduler).toHaveBeenCalledWith(
      'recover-pending-email-deliveries',
      { every: 60_000 },
      {
        name: EMAIL_JOB_NAMES.RECOVER_PENDING,
        data: { requestedAt: expect.any(String) },
      },
    );
    expect(queues[1]!.upsertJobScheduler).toHaveBeenCalledWith(
      'cleanup-abandoned-attachments',
      { every: 900_000 },
      {
        name: MAINTENANCE_JOB_NAMES.CLEANUP_ATTACHMENTS,
        data: { scheduled: true },
      },
    );
  });
  it('closes both queues before quitting both Redis connections', async () => {
    let finishClose!: () => void;
    queues[0]!.close.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );
    const pending = service.onModuleDestroy();
    expect(queues[0]!.close).toHaveBeenCalledTimes(1);
    expect(queues[1]!.close).toHaveBeenCalledTimes(1);
    for (const connection of connections)
      expect(connection.quit).not.toHaveBeenCalled();
    finishClose();
    await pending;
    for (const connection of connections)
      expect(connection.quit).toHaveBeenCalledTimes(1);
  });
  it('still disposes the other resources when one queue or connection fails to close', async () => {
    queues[0]!.close.mockRejectedValue(new Error('queue close failed'));
    connections[0]!.quit.mockRejectedValue(new Error('connection quit failed'));
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    for (const queue of queues) expect(queue.close).toHaveBeenCalledTimes(1);
    for (const connection of connections)
      expect(connection.quit).toHaveBeenCalledTimes(1);
  });
});
