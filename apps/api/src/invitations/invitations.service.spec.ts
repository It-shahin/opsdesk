import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createHash } from 'node:crypto';

import { PrismaService } from '../database/prisma.service.js';
import type { Role } from '../generated/prisma/enums.js';
import type { TenantContext } from '../tenancy/tenant-context.types.js';
import { InvitationsService } from './invitations.service.js';

type InvitationRecord = {
  id: string;
  email: string;
  role: Role;
  expiresAt: Date;
  acceptedAt: Date | null;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  };
};

type AcceptanceInvitationRecord = {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  expiresAt: Date;
  acceptedAt: Date | null;
  canceledAt: Date | null;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

type MembershipRecord = {
  id: string;
  role: Role;
  createdAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

describe('InvitationsService', () => {
  let service: InvitationsService;

  const userFindUniqueMock =
    jest.fn<
      (args: unknown) =>
        Promise<{ id: string } | null>
    >();
  const membershipFindUniqueMock =
    jest.fn<
      (args: unknown) =>
        Promise<{ id: string } | null>
    >();
  const membershipCreateMock =
    jest.fn<
      (args: unknown) =>
        Promise<MembershipRecord>
    >();
  const pendingFindFirstMock =
    jest.fn<
      (args: unknown) =>
        Promise<{ id: string } | null>
    >();
  const createMock =
    jest.fn<
      (args: unknown) =>
        Promise<InvitationRecord>
    >();
  const invitationFindUniqueMock =
    jest.fn<
      (args: unknown) =>
        Promise<AcceptanceInvitationRecord | null>
    >();
  const invitationUpdateManyMock =
    jest.fn<
      (args: unknown) =>
        Promise<{ count: number }>
    >();
  const findManyMock =
    jest.fn<
      (args: unknown) =>
        Promise<InvitationRecord[]>
    >();
  const findFirstMock =
    jest.fn<
      (args: unknown) =>
        Promise<InvitationRecord | null>
    >();
  const updateMock =
    jest.fn<
      (args: unknown) =>
        Promise<InvitationRecord>
    >();

  const transactionClient = {
    user: {
      findUnique: userFindUniqueMock,
    },
    membership: {
      findUnique:
        membershipFindUniqueMock,
      create:
        membershipCreateMock,
    },
    invitation: {
      findFirst:
        pendingFindFirstMock,
      findUnique:
        invitationFindUniqueMock,
      create: createMock,
      updateMany:
        invitationUpdateManyMock,
    },
  };

  type TransactionCallback = (
    transaction:
      typeof transactionClient,
  ) => unknown;

  const transactionMock =
    jest.fn<
      (
        callback: TransactionCallback,
        options: unknown,
      ) => Promise<unknown>
    >();

  const prisma = {
    invitation: {
      findMany: findManyMock,
      findFirst: findFirstMock,
      update: updateMock,
    },
    $transaction: transactionMock,
  };

  const owner: TenantContext = {
    userId:
      '11111111-1111-4111-8111-111111111111',
    organizationId:
      '22222222-2222-4222-8222-222222222222',
    membershipId:
      '33333333-3333-4333-8333-333333333333',
    role: 'OWNER',
  };

  const admin: TenantContext = {
    ...owner,
    userId:
      '44444444-4444-4444-8444-444444444444',
    membershipId:
      '55555555-5555-4555-8555-555555555555',
    role: 'ADMIN',
  };

  const viewer: TenantContext = {
    ...owner,
    userId:
      '66666666-6666-4666-8666-666666666666',
    membershipId:
      '77777777-7777-4777-8777-777777777777',
    role: 'VIEWER',
  };

  const invitation: InvitationRecord = {
    id:
      '88888888-8888-4888-8888-888888888888',
    email:
      'future-agent@example.com',
    role: 'AGENT',
    expiresAt:
      new Date('2099-01-08T00:00:00.000Z'),
    acceptedAt: null,
    canceledAt: null,
    createdAt:
      new Date('2099-01-01T00:00:00.000Z'),
    updatedAt:
      new Date('2099-01-01T00:00:00.000Z'),
    invitedBy: {
      id: owner.userId,
      name: 'Owner',
      email: 'owner@example.com',
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();

    transactionMock.mockImplementation(
      async (callback) =>
        callback(transactionClient),
    );

    userFindUniqueMock.mockResolvedValue(
      null,
    );
    membershipFindUniqueMock.mockResolvedValue(
      null,
    );
    pendingFindFirstMock.mockResolvedValue(
      null,
    );
    invitationUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    service = new InvitationsService(
      prisma as unknown as PrismaService,
    );
  });

  it('creates an invitation with a normalized email and hashed token', async () => {
    userFindUniqueMock.mockResolvedValue(
      null,
    );
    pendingFindFirstMock.mockResolvedValue(
      null,
    );
    createMock.mockResolvedValue(
      invitation,
    );

    const beforeCreate = Date.now();
    const result = await service.create(
      owner,
      '  Future-Agent@Example.com  ',
      'AGENT',
    );
    const afterCreate = Date.now();

    expect(
      userFindUniqueMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email:
            'future-agent@example.com',
        },
      }),
    );

    const createArgs =
      createMock.mock.calls[0]?.[0] as {
        data: {
          organizationId: string;
          email: string;
          role: Role;
          tokenHash: string;
          invitedByUserId: string;
          expiresAt: Date;
        };
      };

    expect(createArgs.data).toEqual(
      expect.objectContaining({
        organizationId:
          owner.organizationId,
        email:
          'future-agent@example.com',
        role: 'AGENT',
        invitedByUserId:
          owner.userId,
      }),
    );

    expect(
      createArgs.data.tokenHash,
    ).toBe(
      createHash('sha256')
        .update(result.acceptanceToken)
        .digest('hex'),
    );

    const sevenDays =
      7 * 24 * 60 * 60 * 1000;

    expect(
      createArgs.data.expiresAt.getTime(),
    ).toBeGreaterThanOrEqual(
      beforeCreate + sevenDays,
    );
    expect(
      createArgs.data.expiresAt.getTime(),
    ).toBeLessThanOrEqual(
      afterCreate + sevenDays,
    );

    expect(result).toEqual({
      ...invitation,
      status: 'PENDING',
      acceptanceToken:
        expect.any(String),
    });

    expect(
      transactionMock,
    ).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel:
          'Serializable',
      },
    );
  });

  it('rejects an invitation for an existing member', async () => {
    userFindUniqueMock.mockResolvedValue({
      id: 'existing-user',
    });
    membershipFindUniqueMock.mockResolvedValue({
      id: 'existing-membership',
    });

    await expect(
      service.create(
        owner,
        invitation.email,
        invitation.role,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      pendingFindFirstMock,
    ).not.toHaveBeenCalled();
    expect(
      createMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects a duplicate pending invitation', async () => {
    userFindUniqueMock.mockResolvedValue(
      null,
    );
    pendingFindFirstMock.mockResolvedValue({
      id: invitation.id,
    });

    await expect(
      service.create(
        owner,
        invitation.email,
        invitation.role,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      createMock,
    ).not.toHaveBeenCalled();
  });

  it('prevents admins from inviting owners or admins', async () => {
    await expect(
      service.create(
        admin,
        'owner@example.com',
        'OWNER',
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    await expect(
      service.create(
        admin,
        'admin@example.com',
        'ADMIN',
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      transactionMock,
    ).not.toHaveBeenCalled();
  });

  it('prevents viewers from creating invitations', async () => {
    await expect(
      service.create(
        viewer,
        invitation.email,
        'AGENT',
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      transactionMock,
    ).not.toHaveBeenCalled();
  });

  it('lists invitations with their derived statuses', async () => {
    findManyMock.mockResolvedValue([
      invitation,
      {
        ...invitation,
        id: 'accepted-invitation',
        acceptedAt:
          new Date('2099-01-02T00:00:00.000Z'),
      },
      {
        ...invitation,
        id: 'canceled-invitation',
        canceledAt:
          new Date('2099-01-02T00:00:00.000Z'),
      },
      {
        ...invitation,
        id: 'expired-invitation',
        expiresAt:
          new Date('2000-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.list(
      owner.organizationId,
    );

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId:
            owner.organizationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    );

    expect(
      result.map((item) => item.status),
    ).toEqual([
      'PENDING',
      'ACCEPTED',
      'CANCELED',
      'EXPIRED',
    ]);
  });

  it('returns 404 when canceling an invitation outside the tenant', async () => {
    findFirstMock.mockResolvedValue(
      null,
    );

    await expect(
      service.cancel(
        owner,
        'missing-invitation',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });

  it('prevents admins from canceling owner invitations', async () => {
    findFirstMock.mockResolvedValue({
      ...invitation,
      role: 'OWNER',
    });

    await expect(
      service.cancel(
        admin,
        invitation.id,
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects canceling an accepted invitation', async () => {
    findFirstMock.mockResolvedValue({
      ...invitation,
      acceptedAt:
        new Date('2099-01-02T00:00:00.000Z'),
    });

    await expect(
      service.cancel(
        owner,
        invitation.id,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });

  it('returns an already canceled invitation without updating it again', async () => {
    const canceledAt =
      new Date('2099-01-02T00:00:00.000Z');

    findFirstMock.mockResolvedValue({
      ...invitation,
      canceledAt,
    });

    const result = await service.cancel(
      owner,
      invitation.id,
    );

    expect(result.status).toBe(
      'CANCELED',
    );
    expect(result.canceledAt).toBe(
      canceledAt,
    );
    expect(
      updateMock,
    ).not.toHaveBeenCalled();
  });

  it('cancels a pending invitation', async () => {
    const canceledAt = new Date();
    const canceledInvitation = {
      ...invitation,
      canceledAt,
    };

    findFirstMock.mockResolvedValue(
      invitation,
    );
    updateMock.mockResolvedValue(
      canceledInvitation,
    );

    const result = await service.cancel(
      owner,
      invitation.id,
    );

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: invitation.id,
        },
        data: {
          canceledAt:
            expect.any(Date),
        },
      }),
    );

    expect(result).toEqual({
      ...canceledInvitation,
      status: 'CANCELED',
    });
  });

  describe('accept', () => {
    const rawToken =
      'this-is-a-secure-test-token-with-enough-length';

    const invitedUser = {
      id:
        '99999999-9999-4999-8999-999999999999',
      email:
        'invited@example.com',
    };

    const organization = {
      id: owner.organizationId,
      name: 'OpsDesk Demo',
      slug: 'opsdesk-demo',
    };

    const pendingInvitation =
      (): AcceptanceInvitationRecord => ({
        id: invitation.id,
        organizationId:
          owner.organizationId,
        email:
          invitedUser.email,
        role: 'AGENT',
        expiresAt: new Date(
          Date.now() +
            24 * 60 * 60 * 1000,
        ),
        acceptedAt: null,
        canceledAt: null,
        organization,
      });

    it('accepts a valid invitation and creates a membership', async () => {
      invitationFindUniqueMock.mockResolvedValue(
        pendingInvitation(),
      );

      const createdAt = new Date();
      membershipCreateMock.mockResolvedValue({
        id: 'new-membership',
        role: 'AGENT',
        createdAt,
        organization,
      });

      const result = await service.accept(
        invitedUser,
        rawToken,
      );

      const expectedHash =
        createHash('sha256')
          .update(rawToken)
          .digest('hex');

      expect(
        invitationFindUniqueMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tokenHash:
              expectedHash,
          },
        }),
      );

      expect(
        invitationUpdateManyMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where:
            expect.objectContaining({
              id: invitation.id,
              acceptedAt: null,
              canceledAt: null,
            }),
          data:
            expect.objectContaining({
              acceptedByUserId:
                invitedUser.id,
            }),
        }),
      );

      expect(
        membershipCreateMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId:
              invitedUser.id,
            organizationId:
              owner.organizationId,
            role: 'AGENT',
          },
        }),
      );

      expect(result).toEqual({
        membership: {
          id: 'new-membership',
          role: 'AGENT',
          createdAt,
        },
        organization,
        invitation: {
          id: invitation.id,
          acceptedAt:
            expect.any(Date),
        },
      });
    });

    it('rejects the wrong authenticated email', async () => {
      invitationFindUniqueMock.mockResolvedValue(
        pendingInvitation(),
      );

      await expect(
        service.accept(
          {
            ...invitedUser,
            email:
              'attacker@example.com',
          },
          rawToken,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(
        invitationUpdateManyMock,
      ).not.toHaveBeenCalled();
      expect(
        membershipCreateMock,
      ).not.toHaveBeenCalled();
    });

    it('rejects an already accepted invitation', async () => {
      invitationFindUniqueMock.mockResolvedValue({
        ...pendingInvitation(),
        acceptedAt: new Date(),
      });

      await expect(
        service.accept(
          invitedUser,
          rawToken,
        ),
      ).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(
        membershipCreateMock,
      ).not.toHaveBeenCalled();
    });

    it('rejects a canceled invitation', async () => {
      invitationFindUniqueMock.mockResolvedValue({
        ...pendingInvitation(),
        canceledAt: new Date(),
      });

      await expect(
        service.accept(
          invitedUser,
          rawToken,
        ),
      ).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(
        membershipCreateMock,
      ).not.toHaveBeenCalled();
    });

    it('rejects an expired invitation', async () => {
      invitationFindUniqueMock.mockResolvedValue({
        ...pendingInvitation(),
        expiresAt: new Date(
          Date.now() -
            24 * 60 * 60 * 1000,
        ),
      });

      await expect(
        service.accept(
          invitedUser,
          rawToken,
        ),
      ).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(
        membershipCreateMock,
      ).not.toHaveBeenCalled();
    });

    it('rejects acceptance when the user is already a member', async () => {
      invitationFindUniqueMock.mockResolvedValue(
        pendingInvitation(),
      );
      membershipFindUniqueMock.mockResolvedValue({
        id: 'existing-membership',
      });

      await expect(
        service.accept(
          invitedUser,
          rawToken,
        ),
      ).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(
        invitationUpdateManyMock,
      ).not.toHaveBeenCalled();
      expect(
        membershipCreateMock,
      ).not.toHaveBeenCalled();
    });

    it('rejects a token that loses the acceptance race', async () => {
      invitationFindUniqueMock.mockResolvedValue(
        pendingInvitation(),
      );
      invitationUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.accept(
          invitedUser,
          rawToken,
        ),
      ).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(
        membershipCreateMock,
      ).not.toHaveBeenCalled();
    });

    it('returns 404 for an invalid token', async () => {
      invitationFindUniqueMock.mockResolvedValue(
        null,
      );

      await expect(
        service.accept(
          invitedUser,
          rawToken,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(
        membershipCreateMock,
      ).not.toHaveBeenCalled();
    });
  });
});
