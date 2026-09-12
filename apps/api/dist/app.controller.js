var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';
import { RedisService } from './redis/redis.service.js';
import { Public } from './auth/public.decorator.js';
let AppController = class AppController {
    prisma;
    redis;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    getRoot() {
        return {
            name: 'OpsDesk API',
            status: 'running',
        };
    }
    async health() {
        await this.prisma.$queryRaw `SELECT 1`;
        const redis = await this.redis.ping();
        return {
            status: 'healthy',
            services: {
                database: 'connected',
                redis: redis === 'PONG' ? 'connected' : 'unavailable',
            },
        };
    }
};
__decorate([
    Public(),
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getRoot", null);
__decorate([
    Public(),
    Get('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "health", null);
AppController = __decorate([
    Controller(),
    __metadata("design:paramtypes", [PrismaService,
        RedisService])
], AppController);
export { AppController };
//# sourceMappingURL=app.controller.js.map