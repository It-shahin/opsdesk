import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/public.decorator.js';
import { HealthService } from './health/health.service.js';

@Controller()
export class AppController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @SkipThrottle()
  @Get()
  getRoot() {
    return {
      name: 'OpsDesk API',
      status: 'running',
    };
  }

  @Public()
  @SkipThrottle()
  @Get('health/live')
  live() {
    return this.health.liveness();
  }

  @Public()
  @SkipThrottle()
  @Get('health/ready')
  ready() {
    return this.health.readiness();
  }

  // Keep the old route as a readiness alias for compatibility.
  @Public()
  @SkipThrottle()
  @Get('health')
  healthCheck() {
    return this.health.readiness();
  }
}
