import { Logger, ValidationPipe, } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { SocketIoAdapter } from './realtime/socket-io.adapter.js';
import { RealtimeRedisAdapterService } from './realtime/realtime-redis-adapter.service.js';
import { configureHttpSecurity } from './security/http-security.js';
async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        rawBody: true,
    });
    configureHttpSecurity(app, process.env.NODE_ENV === 'production');
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const config = app.get(ConfigService);
    const realtimeRedis = app.get(RealtimeRedisAdapterService);
    await realtimeRedis.connect();
    app.useWebSocketAdapter(new SocketIoAdapter(app, config.getOrThrow('WEB_ORIGIN'), realtimeRedis.getAdapter()));
    app.enableShutdownHooks();
    await app.listen(process.env.PORT ?? 3001);
}
void bootstrap()
    .catch((error) => {
    const logger = new Logger('Bootstrap');
    logger.error('OpsDesk API failed to start', error instanceof
        Error
        ? error.stack
        : undefined);
    process.exit(1);
});
//# sourceMappingURL=main.js.map