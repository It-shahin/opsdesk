import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Namespace, Socket } from 'socket.io';

import type { AccessTokenVerifierService } from '../auth/access-token-verifier.service.js';
import { RealtimeGateway } from './realtime.gateway.js';
import type { AuthenticatedSocket, RealtimeSocketData } from './realtime.types.js';

describe('RealtimeGateway', () => {
  const verifyMock = jest.fn<AccessTokenVerifierService['verify']>();
  const useMock = jest.fn<Namespace['use']>();
  let gateway: RealtimeGateway;
  let middleware: Parameters<Namespace['use']>[0];

  beforeEach(() => {
    jest.resetAllMocks();

    gateway = new RealtimeGateway({
      verify: verifyMock,
    } as unknown as AccessTokenVerifierService);

    gateway.afterInit({ use: useMock } as unknown as Namespace);
    middleware = useMock.mock.calls[0]![0];
  });

  function createSocket(token?: string) {
    return {
      id: 'socket-1',
      handshake: { auth: token === undefined ? {} : { token } },
      data: {} as Partial<RealtimeSocketData>,
      emit: jest.fn(),
    };
  }

  it('rejects connections without an access token', async () => {
    const socket = createSocket();
    const next = jest.fn<Parameters<typeof middleware>[1]>();

    await middleware(socket as unknown as Socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Authentication required',
        data: { code: 'MISSING_ACCESS_TOKEN' },
      }),
    );
    expect(verifyMock).not.toHaveBeenCalled();
    expect(socket.data.auth).toBeUndefined();
  });

  it('rejects connections with an invalid access token', async () => {
    verifyMock.mockRejectedValue(
      new UnauthorizedException('Invalid access token'),
    );
    const socket = createSocket('invalid-token');
    const next = jest.fn<Parameters<typeof middleware>[1]>();

    await middleware(socket as unknown as Socket, next);

    expect(verifyMock).toHaveBeenCalledWith('invalid-token');
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Authentication failed',
        data: { code: 'INVALID_ACCESS_TOKEN' },
      }),
    );
    expect(socket.data.auth).toBeUndefined();
  });

  it('verifies valid tokens and stores the verified principal', async () => {
    const principal = { sub: 'auth0|user-1' };
    verifyMock.mockResolvedValue(principal);
    const socket = createSocket('valid-token');
    const next = jest.fn<Parameters<typeof middleware>[1]>();

    await middleware(socket as unknown as Socket, next);

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith('valid-token');
    expect(socket.data.auth).toEqual(
      expect.objectContaining({ sub: 'auth0|user-1' }),
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('emits realtime.ready on connection', () => {
    const socket = createSocket();
    socket.data.auth = { sub: 'auth0|user-1' };

    gateway.handleConnection(socket as unknown as AuthenticatedSocket);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('realtime.ready', {
      connectedAt: expect.any(String),
    });
  });
});
