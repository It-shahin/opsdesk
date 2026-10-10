import { ApiResource, ApiResult } from './openapi/api-documentation.js';
import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/public.decorator.js';
import { HealthService } from './health/health.service.js';

@ApiResource('Health')
@Controller()
export class AppController {
  constructor(private readonly health: HealthService) {}

  @ApiResult('Root')
  @Public()
  @SkipThrottle()
  @Get()
  getRoot() {
    return {
      name: 'OpsDesk API',
      status: 'running',
    };
  }

  @ApiResult('Live')
  @Public()
  @SkipThrottle()
  @Get('health/live')
  live() {
    return this.health.liveness();
  }

  @ApiResult('Ready')
  @Public()
  @SkipThrottle()
  @Get('health/ready')
  ready() {
    return this.health.readiness();
  }

  // Keep the old route as a readiness alias for compatibility.
  @ApiResult('Ready')
  @Public()
  @SkipThrottle()
  @Get('health')
  healthCheck() {
    return this.health.readiness();
  }
}
