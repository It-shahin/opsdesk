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
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/public.decorator.js';
import { HealthService } from './health/health.service.js';
let AppController = class AppController {
    health;
    constructor(health) {
        this.health = health;
    }
    getRoot() {
        return {
            name: 'OpsDesk API',
            status: 'running',
        };
    }
    live() {
        return this.health.liveness();
    }
    ready() {
        return this.health.readiness();
    }
    healthCheck() {
        return this.health.readiness();
    }
};
__decorate([
    Public(),
    SkipThrottle(),
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getRoot", null);
__decorate([
    Public(),
    SkipThrottle(),
    Get('health/live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "live", null);
__decorate([
    Public(),
    SkipThrottle(),
    Get('health/ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "ready", null);
__decorate([
    Public(),
    SkipThrottle(),
    Get('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "healthCheck", null);
AppController = __decorate([
    Controller(),
    __metadata("design:paramtypes", [HealthService])
], AppController);
export { AppController };
//# sourceMappingURL=app.controller.js.map