import Redis from 'ioredis';

export function createQueueRedisConnection(
  redisUrl: string,
) {
  return new Redis(
    redisUrl,
    {
      maxRetriesPerRequest: 1,
    },
  );
}

export function createWorkerRedisConnection(
  redisUrl: string,
) {
  return new Redis(
    redisUrl,
    {
      maxRetriesPerRequest:
        null,
    },
  );
}