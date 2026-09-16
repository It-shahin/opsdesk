import {
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';

import { PERMISSIONS } from './permissions.js';
import { PermissionsService } from './permissions.service.js';

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(() => {
    service =
      new PermissionsService();
  });

  it('allows owners to manage members', () => {
    expect(
      service.hasPermission(
        'OWNER',
        PERMISSIONS.MEMBERS_MANAGE,
      ),
    ).toBe(true);
  });

  it('allows admins to manage members', () => {
    expect(
      service.hasPermission(
        'ADMIN',
        PERMISSIONS.MEMBERS_MANAGE,
      ),
    ).toBe(true);
  });

  it('prevents agents from managing members', () => {
    expect(
      service.hasPermission(
        'AGENT',
        PERMISSIONS.MEMBERS_MANAGE,
      ),
    ).toBe(false);
  });

  it('prevents viewers from managing invitations', () => {
    expect(
      service.hasPermission(
        'VIEWER',
        PERMISSIONS.INVITATIONS_MANAGE,
      ),
    ).toBe(false);
  });

  it('allows agents to read members', () => {
    expect(
      service.hasPermission(
        'AGENT',
        PERMISSIONS.MEMBERS_READ,
      ),
    ).toBe(true);
  });

  it('checks multiple required permissions', () => {
    expect(
      service.hasAllPermissions(
        'ADMIN',
        [
          PERMISSIONS.MEMBERS_READ,
          PERMISSIONS.MEMBERS_MANAGE,
        ],
      ),
    ).toBe(true);

    expect(
      service.hasAllPermissions(
        'VIEWER',
        [
          PERMISSIONS.MEMBERS_READ,
          PERMISSIONS.MEMBERS_MANAGE,
        ],
      ),
    ).toBe(false);
  });

  it('allows agents to manage customers', () => {
    expect(
      service.hasPermission(
        'AGENT',
        PERMISSIONS.CUSTOMERS_WRITE,
      ),
    ).toBe(true);
  });

  it('keeps viewers read-only for customers', () => {
    expect(
      service.hasPermission(
        'VIEWER',
        PERMISSIONS.CUSTOMERS_READ,
      ),
    ).toBe(true);

    expect(
      service.hasPermission(
        'VIEWER',
        PERMISSIONS.CUSTOMERS_WRITE,
      ),
    ).toBe(false);
  });
});

