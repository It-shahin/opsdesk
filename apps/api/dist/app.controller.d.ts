import { PrismaService } from './database/prisma.service.js';
import { RedisService } from './redis/redis.service.js';
export declare class AppController {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: RedisService);
    getRoot(): {
        name: string;
        status: string;
    };
    health(): Promise<{
        status: string;
        services: {
            database: string;
            redis: string;
        };
    }>;
}
