import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Auth0UserInfoService } from '../auth/auth0-userinfo.service.js';
import type {
  Auth0UserProfile,
  AuthenticatedRequest,
} from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { UsersService } from './users.service.js';

type MockUser = {
  id: string;
  authProviderId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type FindUniqueArgs = {
  where: {
    authProviderId?: string;
    email?: string;
  };
};

type UpdateArgs = {
  where: {
    id: string;
  };
  data: {
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
};

type CreateArgs = {
  data: {
    authProviderId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
};

describe('UsersService', () => {
  let service: UsersService;

  const findUniqueMock =
    jest.fn<(args: FindUniqueArgs) => Promise<MockUser | null>>();

  const updateMock = jest.fn<(args: UpdateArgs) => Promise<MockUser>>();

  const createMock = jest.fn<(args: CreateArgs) => Promise<MockUser>>();

  const getUserProfileMock =
    jest.fn<
      (
        accessToken: string,
        expectedSubject: string,
      ) => Promise<Auth0UserProfile>
    >();

  const prisma = {
    user: {
      findUnique: findUniqueMock,
      update: updateMock,
      create: createMock,
    },
  };

  const auth0UserInfo = {
    getUserProfile: getUserProfileMock,
  };

  const request = {
    auth: {
      sub: 'google-oauth2|123456',
    },
    accessToken: 'test-access-token',
  } as AuthenticatedRequest;

  const profile: Auth0UserProfile = {
    sub: 'google-oauth2|123456',
    email: 'User@Example.com',
    emailVerified: true,
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
  };

  const existingUser: MockUser = {
    id: '11111111-1111-1111-1111-111111111111',
    authProviderId: profile.sub,
    email: 'user@example.com',
    name: 'Old Name',
    avatarUrl: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UsersService(
      prisma as unknown as PrismaService,
      auth0UserInfo as unknown as Auth0UserInfoService,
    );
  });

  it('creates a local user on first login', async () => {
    getUserProfileMock.mockResolvedValue(profile);

    findUniqueMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const createdUser: MockUser = {
      ...existingUser,
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    };

    createMock.mockResolvedValue(createdUser);

    const result = await service.syncAuthenticatedUser(request);

    expect(getUserProfileMock).toHaveBeenCalledWith(
      request.accessToken,
      request.auth.sub,
    );

    expect(findUniqueMock).toHaveBeenNthCalledWith(1, {
      where: {
        authProviderId: profile.sub,
      },
    });

    expect(findUniqueMock).toHaveBeenNthCalledWith(2, {
      where: {
        email: 'user@example.com',
      },
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        authProviderId: profile.sub,
        email: 'user@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
    });

    expect(result).toEqual(createdUser);
  });

  it('updates an existing user on returning login', async () => {
    getUserProfileMock.mockResolvedValue(profile);

    findUniqueMock.mockResolvedValue(existingUser);

    const updatedUser: MockUser = {
      ...existingUser,
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      updatedAt: new Date('2026-09-12'),
    };

    updateMock.mockResolvedValue(updatedUser);

    const result = await service.syncAuthenticatedUser(request);

    expect(updateMock).toHaveBeenCalledWith({
      where: {
        id: existingUser.id,
      },
      data: {
        email: 'user@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
    });

    expect(createMock).not.toHaveBeenCalled();

    expect(result).toEqual(updatedUser);
  });

  it('rejects users whose email is not verified', async () => {
    getUserProfileMock.mockResolvedValue({
      ...profile,
      emailVerified: false,
    });

    await expect(service.syncAuthenticatedUser(request)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(findUniqueMock).not.toHaveBeenCalled();

    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects a different identity using an existing email', async () => {
    getUserProfileMock.mockResolvedValue(profile);

    findUniqueMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...existingUser,
      authProviderId: 'auth0|different-identity',
    });

    await expect(service.syncAuthenticatedUser(request)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(createMock).not.toHaveBeenCalled();
  });
});
