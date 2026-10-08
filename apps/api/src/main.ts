import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';

import { SocketIoAdapter } from './realtime/socket-io.adapter.js';

import { RealtimeRedisAdapterService } from './realtime/realtime-redis-adapter.service.js';
import { configureHttpSecurity } from './security/http-security.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  configureHttpSecurity(app, process.env.NODE_ENV === 'production');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);

  const realtimeRedis = app.get(RealtimeRedisAdapterService);

  await realtimeRedis.connect();

  app.useWebSocketAdapter(
    new SocketIoAdapter(
      app,

      config.getOrThrow<string>('WEB_ORIGIN'),

      realtimeRedis.getAdapter(),
    ),
  );

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
