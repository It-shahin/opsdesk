import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import {
  ConfigService,
} from '@nestjs/config';

import {
  SocketIoAdapter,
} from './realtime/socket-io.adapter.js';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    {
      rawBody: true,
    },
  );
  app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);

const config =
  app.get(
    ConfigService,
  );

app.useWebSocketAdapter(
  new SocketIoAdapter(
    app,

    config.getOrThrow<string>(
      'WEB_ORIGIN',
    ),
  ),
);

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();