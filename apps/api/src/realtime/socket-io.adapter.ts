import type {
  INestApplicationContext,
} from '@nestjs/common';

import {
  IoAdapter,
} from '@nestjs/platform-socket.io';

type IoServerOptions = NonNullable<
  Parameters<IoAdapter['createIOServer']>[1]
>;

export class SocketIoAdapter
  extends IoAdapter
{
  constructor(
    app:
      INestApplicationContext,

    private readonly webOrigin:
      string,
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
  ): ReturnType<IoAdapter['createIOServer']> {
    const serverOptions: Partial<IoServerOptions> = {
      ...options,
      cors: {
        origin: this.webOrigin,
        methods: ['GET', 'POST'],
        // Authentication uses the Socket.IO auth payload, without cookies.
        credentials: false,
      },
    };

    // Socket.IO accepts partial options and fills in defaults. Nest's
    // createIOServer declaration requires the complete options type.
    return super.createIOServer(
      port,
      serverOptions as IoServerOptions,
    );
  }
}
