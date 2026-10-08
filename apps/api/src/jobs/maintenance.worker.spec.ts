import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import type { AttachmentsService } from '../attachments/attachments.service.js';
import { MAINTENANCE_JOB_NAMES, QUEUE_NAMES } from './jobs.constants.js';

type Processor = (job: { name: string }) => Promise<unknown>;
const workers: TestWorker[] = [];
class TestWorker extends EventEmitter {
  close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  constructor(
    readonly queue: string,
    readonly process: Processor,
  ) {
    super();
    workers.push(this);
  }
}
class UnrecoverableError extends Error {}
jest.unstable_mockModule('bullmq', () => ({
  Worker: TestWorker,
  Queue: class {},
  UnrecoverableError,
}));
const quit = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
jest.unstable_mockModule('./bullmq-connection.js', () => ({
  createWorkerRedisConnection: () => ({ quit }),
}));
const { MaintenanceWorker } = await import('./maintenance.worker.js');

describe('MaintenanceWorker cleanup and shutdown', () => {
  const attachments = {
    cleanupAbandonedUploads:
      jest.fn<AttachmentsService['cleanupAbandonedUploads']>(),
  };
  let service: InstanceType<typeof MaintenanceWorker>;
  beforeEach(() => {
    jest.clearAllMocks();
    workers.length = 0;
    service = new MaintenanceWorker(
      {
        getOrThrow: () => 'redis://localhost:6379',
      } as unknown as ConfigService,
      attachments as unknown as AttachmentsService,
    );
  });
  it('completes successful attachment cleanup through the BullMQ processor', async () => {
    const result = { scanned: 5, deleted: 5, failed: 0 };
    attachments.cleanupAbandonedUploads.mockResolvedValue(result);
    await service.onModuleInit();
    expect(workers[0]!.queue).toBe(QUEUE_NAMES.MAINTENANCE);
    await expect(
      workers[0]!.process({ name: MAINTENANCE_JOB_NAMES.CLEANUP_ATTACHMENTS }),
    ).resolves.toEqual(result);
    expect(attachments.cleanupAbandonedUploads).toHaveBeenCalledTimes(1);
  });
  it('rejects partial cleanup so BullMQ can retry and report the failed job', async () => {
    attachments.cleanupAbandonedUploads.mockResolvedValue({
      scanned: 5,
      deleted: 4,
      failed: 1,
    });
    await service.onModuleInit();
    const pending = workers[0]!.process({
      name: MAINTENANCE_JOB_NAMES.CLEANUP_ATTACHMENTS,
    });
    await expect(pending).rejects.toThrow(
      'Attachment cleanup completed with failures',
    );
    await expect(pending).rejects.not.toBeInstanceOf(UnrecoverableError);
  });
  it('propagates cleanup failures to BullMQ', async () => {
    const error = new Error('storage unavailable');
    attachments.cleanupAbandonedUploads.mockRejectedValue(error);
    await service.onModuleInit();
    await expect(
      workers[0]!.process({ name: MAINTENANCE_JOB_NAMES.CLEANUP_ATTACHMENTS }),
    ).rejects.toBe(error);
  });
  it('closes the worker before quitting its Redis connection', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();
    expect(workers[0]!.close).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
    expect(workers[0]!.close.mock.invocationCallOrder[0]).toBeLessThan(
      quit.mock.invocationCallOrder[0]!,
    );
  });
  it('quits Redis even when shutdown happens before worker initialization', async () => {
    await service.onModuleDestroy();
    expect(workers).toHaveLength(0);
    expect(quit).toHaveBeenCalledTimes(1);
  });
});
