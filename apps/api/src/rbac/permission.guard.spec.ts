import {
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { TenantAuthenticatedRequest } from '../tenancy/tenant-context.types.js';
import { PermissionGuard } from './permission.guard.js';
import { PERMISSIONS } from './permissions.js';
import { PermissionsService } from './permissions.service.js';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  const getAllAndOverrideMock =
    jest.fn();

  const hasAllPermissionsMock =
    jest.fn();

  const reflector = {
    getAllAndOverride:
      getAllAndOverrideMock,
  };

  const permissionsService = {
    hasAllPermissions:
      hasAllPermissionsMock,
  };

  function createContext(
    role:
      | 'OWNER'
      | 'ADMIN'
      | 'AGENT'
      | 'VIEWER'
      | undefined,
  ): ExecutionContext {
    const request = {
      tenant: role
        ? {
            userId: 'user-1',
            organizationId: 'org-1',
            membershipId:
              'membership-1',
            role,
          }
        : undefined,
    } as TenantAuthenticatedRequest;

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),

      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    guard = new PermissionGuard(
      reflector as unknown as Reflector,
      permissionsService as unknown as PermissionsService,
    );
  });

  it('allows routes without required permissions', () => {
    getAllAndOverrideMock
      .mockReturnValue(undefined);

    const result = guard.canActivate(
      createContext('VIEWER'),
    );

    expect(result).toBe(true);

    expect(
      hasAllPermissionsMock,
    ).not.toHaveBeenCalled();
  });

  it('allows a role with the required permission', () => {
    getAllAndOverrideMock
      .mockReturnValue([
        PERMISSIONS.MEMBERS_MANAGE,
      ]);

    hasAllPermissionsMock
      .mockReturnValue(true);

    const result = guard.canActivate(
      createContext('ADMIN'),
    );

    expect(result).toBe(true);

    expect(
      hasAllPermissionsMock,
    ).toHaveBeenCalledWith(
      'ADMIN',
      [
        PERMISSIONS.MEMBERS_MANAGE,
      ],
    );
  });

  it('rejects a role without the required permission', () => {
    getAllAndOverrideMock
      .mockReturnValue([
        PERMISSIONS.MEMBERS_MANAGE,
      ]);

    hasAllPermissionsMock
      .mockReturnValue(false);

    expect(() =>
      guard.canActivate(
        createContext('AGENT'),
      ),
    ).toThrow(
      ForbiddenException,
    );
  });

  it('rejects permission checks without tenant context', () => {
    getAllAndOverrideMock
      .mockReturnValue([
        PERMISSIONS.MEMBERS_READ,
      ]);

    expect(() =>
      guard.canActivate(
        createContext(undefined),
      ),
    ).toThrow(
      ForbiddenException,
    );

    expect(
      hasAllPermissionsMock,
    ).not.toHaveBeenCalled();
  });

  it('passes all required permissions to the permission service', () => {
    const required = [
      PERMISSIONS.MEMBERS_READ,
      PERMISSIONS.MEMBERS_MANAGE,
    ];

    getAllAndOverrideMock
      .mockReturnValue(required);

    hasAllPermissionsMock
      .mockReturnValue(true);

    guard.canActivate(
      createContext('OWNER'),
    );

    expect(
      hasAllPermissionsMock,
    ).toHaveBeenCalledWith(
      'OWNER',
      required,
    );
  });
});