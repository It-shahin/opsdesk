import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  getRoot() {
    return {
      name: 'OpsDesk API',
      status: 'running',
    };
  }

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;

    const redis = await this.redis.ping();

    return {
      status: 'healthy',
      services: {
        database: 'connected',
        redis: redis === 'PONG' ? 'connected' : 'unavailable',
      },
    };
  }
}