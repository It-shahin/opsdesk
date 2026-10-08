import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { RedisService } from '../redis/redis.service.js';
import { RealtimeRedisAdapterService } from './realtime-redis-adapter.service.js';

function client() {
  return {
    on: jest.fn(),
    connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    quit: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    disconnect: jest.fn<() => void>(),
  };
}
describe('Realtime Redis adapter lifecycle', () => {
  let pub: ReturnType<typeof client>;
  let sub: ReturnType<typeof client>;
  let service: RealtimeRedisAdapterService;
  beforeEach(() => {
    pub = client();
    sub = client();
    const duplicate = jest
      .fn()
      .mockReturnValueOnce(pub)
      .mockReturnValueOnce(sub);
    service = new RealtimeRedisAdapterService({
      getClient: () => ({ duplicate }),
    } as unknown as RedisService);
  });
  it('quits both dedicated Redis clients on application shutdown', async () => {
    await service.connect();
    await service.onApplicationShutdown();
    expect(pub.quit).toHaveBeenCalledTimes(1);
    expect(sub.quit).toHaveBeenCalledTimes(1);
    expect(pub.disconnect).not.toHaveBeenCalled();
    expect(sub.disconnect).not.toHaveBeenCalled();
    expect(() => service.getAdapter()).toThrow(
      'Realtime Redis adapter is not connected',
    );
  });
  it('quits the subscriber even if quitting the publisher fails', async () => {
    await service.connect();
    pub.quit.mockRejectedValue(new Error('publisher unavailable'));
    await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
    expect(pub.quit).toHaveBeenCalledTimes(1);
    expect(sub.quit).toHaveBeenCalledTimes(1);
  });
  it('disconnects lazy clients when the adapter was never connected', async () => {
    await service.onApplicationShutdown();
    expect(pub.disconnect).toHaveBeenCalledTimes(1);
    expect(sub.disconnect).toHaveBeenCalledTimes(1);
    expect(pub.quit).not.toHaveBeenCalled();
    expect(sub.quit).not.toHaveBeenCalled();
  });
});
