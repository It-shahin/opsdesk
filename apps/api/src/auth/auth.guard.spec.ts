import {
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { AuthGuard } from './auth.guard.js';

describe('AuthGuard', () => {
  let guard: AuthGuard;

  const getAllAndOverride = jest.fn<() => boolean | undefined>();

  const configService = {
    getOrThrow: jest.fn<(key: string) => string>((key: string) => {
      if (key === 'AUTH0_ISSUER_BASE_URL') {
        return 'https://example.auth0.com/';
      }

      if (key === 'AUTH0_AUDIENCE') {
        return 'https://api.opsdesk.dev';
      }

      throw new Error(`Unknown config key: ${key}`);
    }),
  };

  const reflector = {
    getAllAndOverride,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    guard = new AuthGuard(
      configService as unknown as ConfigService,
      reflector as unknown as Reflector,
    );
  });

  function createContext(
    authorization?: string,
  ): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),

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

    await expect(
      guard.canActivate(
        createContext('Bearer not-a-valid-jwt'),
      ),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Invalid access token',
      ),
    );
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