import {
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { AuthGuard } from './auth.guard.js';
import type { AccessTokenVerifierService } from './access-token-verifier.service.js';

describe('AuthGuard', () => {
  let guard: AuthGuard;

  const getAllAndOverride = jest.fn<() => boolean | undefined>();

  const verifyMock = jest.fn<AccessTokenVerifierService['verify']>();

  const accessTokens = {
    verify: verifyMock,
  };

  const reflector = {
    getAllAndOverride,
  };

  beforeEach(() => {
    jest.resetAllMocks();

    guard = new AuthGuard(
      reflector as unknown as Reflector,
      accessTokens as unknown as AccessTokenVerifierService,
    );
  });

  function createContext(
    authorization?: string,
  ): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getType: () => 'http',

      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization,
          },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows endpoints marked as public', async () => {
    getAllAndOverride.mockReturnValue(true);

    const result = await guard.canActivate(
      createContext(),
    );

    expect(result).toBe(true);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('does not apply HTTP authentication to websocket contexts', async () => {
    getAllAndOverride.mockReturnValue(false);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getType: () => 'ws',
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('rejects requests without an access token', async () => {
    getAllAndOverride.mockReturnValue(false);

    await expect(
      guard.canActivate(createContext()),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Missing access token',
      ),
    );
  });

  it('rejects malformed bearer tokens', async () => {
    getAllAndOverride.mockReturnValue(false);
    verifyMock.mockRejectedValue(
      new UnauthorizedException('Invalid access token'),
    );

    await expect(
      guard.canActivate(
        createContext('Bearer not-a-valid-jwt'),
      ),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Invalid access token',
      ),
    );
    expect(verifyMock).toHaveBeenCalledWith('not-a-valid-jwt');
  });

  it('rejects non-Bearer authorization schemes', async () => {
    getAllAndOverride.mockReturnValue(false);

    await expect(
      guard.canActivate(
        createContext('Basic some-token'),
      ),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Missing access token',
      ),
    );
  });
});
