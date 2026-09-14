import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { MembershipsService } from '../memberships/memberships.service.js';
import { TenantContextService } from './tenant-context.service.js';

describe('TenantContextService', () => {
  let service: TenantContextService;

  const findMembershipMock =
    jest.fn();

  const membershipsService = {
    findForUserAndOrganization:
      findMembershipMock,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TenantContextService(
      membershipsService as unknown as MembershipsService,
    );
  });

  it('resolves tenant context from a membership', async () => {
    findMembershipMock.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      organizationId: 'organization-1',
      role: 'OWNER',

      organization: {
        id: 'organization-1',
        name: 'OpsDesk Demo',
        slug: 'opsdesk-demo-ab123456',
      },
    });

    const result = await service.resolve(
      'user-1',
      'organization-1',
    );

    expect(
      findMembershipMock,
    ).toHaveBeenCalledWith(
      'user-1',
      'organization-1',
    );

    expect(result).toEqual({
      userId: 'user-1',
      organizationId: 'organization-1',
      membershipId: 'membership-1',
      role: 'OWNER',
    });
  });

  it('returns null when the user is not a member of the organization', async () => {
    findMembershipMock.mockResolvedValue(
      null,
    );

    const result = await service.resolve(
      'user-1',
      'organization-2',
    );

    expect(result).toBeNull();
  });

  it('uses the role stored in the membership', async () => {
    findMembershipMock.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-1',
      organizationId: 'organization-2',
      role: 'VIEWER',

      organization: {
        id: 'organization-2',
        name: 'Client Workspace',
        slug: 'client-workspace-12345678',
      },
    });

    const result = await service.resolve(
      'user-1',
      'organization-2',
    );

    expect(result?.role).toBe(
      'VIEWER',
    );
  });
});