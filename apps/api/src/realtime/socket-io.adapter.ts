import type {
  INestApplicationContext,
} from '@nestjs/common';

import {
  IoAdapter,
} from '@nestjs/platform-socket.io';

import type {
  createAdapter,
} from '@socket.io/redis-adapter';

type IoServerOptions = NonNullable<
  Parameters<IoAdapter['createIOServer']>[1]
>;

type RedisAdapterConstructor =
  ReturnType<
    typeof createAdapter
  >;

export class SocketIoAdapter
  extends IoAdapter
{
  constructor(
    app:
      INestApplicationContext,

    private readonly webOrigin:
      string,

    private readonly redisAdapter:
    RedisAdapterConstructor,

  ) {
    super(
      app,
    );
  }

  override createIOServer(
  port:
    number,

  options?:
    Partial<IoServerOptions>,
): ReturnType<
  IoAdapter['createIOServer']
> {
  const serverOptions:
    Partial<IoServerOptions> =
    {
      ...options,

      cors: {
        origin:
          this.webOrigin,

        methods: [
          'GET',
          'POST',
        ],

        credentials:
          false,
      },
    };

  const server = super.createIOServer(
    port,
    serverOptions as IoServerOptions,
  );

  server.adapter(
    this.redisAdapter,
  );

  return server;
}
}
