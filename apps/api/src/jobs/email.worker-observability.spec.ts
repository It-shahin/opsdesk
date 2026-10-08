import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const workers: EventEmitter[] = [];
class TestWorker extends EventEmitter {
  close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  constructor() {
    super();
    workers.push(this);
  }
}

// Exercise the real listener registration without opening Redis connections or
// running queue jobs. Other worker specs use the real BullMQ error classes.
jest.unstable_mockModule('bullmq', () => ({
  Worker: TestWorker,
  Queue: class {},
  UnrecoverableError: class extends Error {},
}));
const { EmailWorker } = await import('./email.worker.js');

describe('EmailWorker structured event logging', () => {
  const logger = {
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>(),
  };
  let worker: EventEmitter;
  let emailWorker: InstanceType<typeof EmailWorker>;
  const quit = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    workers.length = 0;
    emailWorker = Object.assign(
      Object.create(EmailWorker.prototype) as InstanceType<typeof EmailWorker>,
      {
        connection: { quit },
        logger,
      },
    );
    emailWorker.onModuleInit();
    worker = workers[0]!;
    logger.log.mockClear();
  });

  const job = {
    id: 'job-1',
    name: 'send-ticket-reply',
    attemptsMade: 2,
    data: {
      recipientEmail: 'secret@example.test',
      body: 'Private customer message',
    },
  };

  it('logs completion metadata without job data or result payloads', () => {
    worker.emit('completed', job, { body: 'private return value' });
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logger.log.mock.calls[0]![0])).toEqual({
      event: 'email.job.completed',
      jobId: 'job-1',
      jobName: 'send-ticket-reply',
      attemptsMade: 2,
    });
  });

  it('logs failed job metadata and error class without the sensitive error message', () => {
    worker.emit(
      'failed',
      job,
      new TypeError('secret@example.test Private customer message'),
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logger.error.mock.calls[0]![0])).toEqual({
      event: 'email.job.failed',
      jobId: 'job-1',
      jobName: 'send-ticket-reply',
      attemptsMade: 2,
      error: 'TypeError',
    });
  });

  it('handles job failures when no job is available', () => {
    worker.emit('failed', undefined, new Error('sensitive context'));
    expect(JSON.parse(logger.error.mock.calls[0]![0])).toEqual({
      event: 'email.job.failed',
      jobId: null,
      jobName: null,
      attemptsMade: null,
      error: 'Error',
    });
  });

  it('handles worker connection/runtime errors without leaking error messages', () => {
    expect(() =>
      worker.emit('error', new Error('redis://secret-password@private-host')),
    ).not.toThrow();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logger.error.mock.calls[0]![0])).toEqual({
      event: 'email.worker.error',
      error: 'Error',
    });
  });

  it('closes the worker before quitting its Redis connection on module destruction', async () => {
    await emailWorker.onModuleDestroy();
    const queueWorker = worker as TestWorker;
    expect(queueWorker.close).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
    expect(queueWorker.close.mock.invocationCallOrder[0]).toBeLessThan(
      quit.mock.invocationCallOrder[0]!,
    );
  });

  it('quits Redis when destroyed before the BullMQ worker is initialized', async () => {
    const uninitialized = Object.assign(
      Object.create(EmailWorker.prototype),
      {
        worker: null,
        connection: { quit },
        logger,
      },
    ) as InstanceType<typeof EmailWorker>;
    await uninitialized.onModuleDestroy();
    expect(quit).toHaveBeenCalledTimes(1);
    expect((worker as TestWorker).close).not.toHaveBeenCalled();
  });
});
