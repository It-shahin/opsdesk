import {
  BadRequestException,
  type ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { TenantContextService } from './tenant-context.service.js';
import { TenantMembershipGuard } from './tenant-membership.guard.js';
import type { TenantAuthenticatedRequest } from './tenant-context.types.js';
import { UsersService } from '../users/users.service.js';

describe('TenantMembershipGuard', () => {
  let guard: TenantMembershipGuard;

  const syncUserMock = jest.fn();
  const resolveTenantMock = jest.fn();

  const usersService = {
    syncAuthenticatedUser:
      syncUserMock,
  };

  const tenantContextService = {
    resolve: resolveTenantMock,
  };

  const organizationId =
    '11111111-1111-4111-8111-111111111111';

  function createContext(options?: {
    organizationId?: string;
    authenticated?: boolean;
  }) {
    const authenticated =
      options?.authenticated ?? true;

    const request = {
      params: {
        organizationId:
          options?.organizationId ??
          organizationId,
      },

      auth: authenticated
        ? {
            sub: 'google-oauth2|123',
          }
        : undefined,

      accessToken: authenticated
        ? 'test-token'
        : undefined,
    } as TenantAuthenticatedRequest;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    return {
      context,
      request,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    guard = new TenantMembershipGuard(
      usersService as unknown as UsersService,
      tenantContextService as unknown as TenantContextService,
    );
  });

  it('rejects an invalid organization UUID', async () => {
    const { context } =
      createContext({
        organizationId:
          'not-a-valid-uuid',
      });

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      syncUserMock,
    ).not.toHaveBeenCalled();

    expect(
      resolveTenantMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects requests without authentication context', async () => {
    const { context } =
      createContext({
        authenticated: false,
      });

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns 404 when the user is not a member', async () => {
    const { context } =
      createContext();

    syncUserMock.mockResolvedValue({
      id: 'user-1',
    });

    resolveTenantMock.mockResolvedValue(
      null,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      resolveTenantMock,
    ).toHaveBeenCalledWith(
      'user-1',
      organizationId,
    );
  });

  it('attaches tenant context for a valid membership', async () => {
    const {
      context,
      request,
    } = createContext();

    syncUserMock.mockResolvedValue({
      id: 'user-1',
    });

    const tenant = {
      userId: 'user-1',
      organizationId,
      membershipId:
        'membership-1',
      role: 'OWNER',
    };

    resolveTenantMock.mockResolvedValue(
      tenant,
    );

    const result =
      await guard.canActivate(context);

    expect(result).toBe(true);

    expect(request.tenant).toEqual(
      tenant,
    );
  });
});