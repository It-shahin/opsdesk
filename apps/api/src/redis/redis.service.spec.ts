import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const clients: TestRedis[] = [];
class TestRedis {
  connect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  quit = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  constructor() {
    clients.push(this);
  }
}
jest.unstable_mockModule('ioredis', () => ({ default: TestRedis }));
const { RedisService } = await import('./redis.service.js');

describe('RedisService lifecycle', () => {
  beforeEach(() => {
    clients.length = 0;
  });
  it('connects on initialization and quits its client on destruction', async () => {
    const service = new RedisService({
      getOrThrow: () => 'redis://localhost:6379',
    } as unknown as ConfigService);
    expect(service.getClient()).toBe(clients[0]);
    await service.onModuleInit();
    expect(clients[0]!.connect).toHaveBeenCalledTimes(1);
    await service.onModuleDestroy();
    expect(clients[0]!.quit).toHaveBeenCalledTimes(1);
  });
});
