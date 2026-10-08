import type { INestApplicationContext } from '@nestjs/common';

import { IoAdapter } from '@nestjs/platform-socket.io';

import type { createAdapter } from '@socket.io/redis-adapter';

type IoServerOptions = NonNullable<Parameters<IoAdapter['createIOServer']>[1]>;

type RedisAdapterConstructor = ReturnType<typeof createAdapter>;

export class SocketIoAdapter extends IoAdapter {
  private readonly allowedOrigin: string;

  constructor(
    app: INestApplicationContext,

    webOrigin: string,

    private readonly redisAdapter: RedisAdapterConstructor,
  ) {
    super(app);
    this.allowedOrigin = new URL(webOrigin).origin;
  }

  override createIOServer(
    port: number,

    options?: Partial<IoServerOptions>,
  ): ReturnType<IoAdapter['createIOServer']> {
    const serverOptions: Partial<IoServerOptions> = {
      ...options,

      cors: {
        origin: this.allowedOrigin,

        methods: ['GET', 'POST'],

        credentials: false,
      },

      // Engine.IO handshakes require an exact Origin match, including WebSockets.
      allowRequest: (request, callback) => {
        callback(null, request.headers.origin === this.allowedOrigin);
      },

      maxHttpBufferSize: 16 * 1024,
    };

    const server = super.createIOServer(port, serverOptions as IoServerOptions);

    server.adapter(this.redisAdapter);

    return server;
  }
}
