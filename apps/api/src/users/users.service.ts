import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Auth0UserInfoService } from '../auth/auth0-userinfo.service.js';
import { PrismaService } from '../database/prisma.service.js';

import type {
  AuthenticatedSession,
} from '../auth/auth.types.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth0UserInfo: Auth0UserInfoService,
  ) {}

  async syncAuthenticatedUser(
  session:
    AuthenticatedSession,
) {
  const profile =
    await this.auth0UserInfo
      .getUserProfile(
        session.accessToken,
        session.auth.sub,
      );

    if (!profile.emailVerified) {
      throw new ForbiddenException(
        'A verified email address is required',
      );
    }

    const normalizedEmail = profile.email.trim().toLowerCase();

    const existingUser =
      await this.prisma.user.findUnique({
        where: {
          authProviderId: profile.sub,
        },
      });

    if (existingUser) {
      return this.prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          email: normalizedEmail,
          name: profile.name ?? null,
          avatarUrl: profile.picture ?? null,
        },
      });
    }

    const userWithSameEmail =
      await this.prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (userWithSameEmail) {
      throw new ConflictException(
        'An account already exists with this email address',
      );
    }

    return this.prisma.user.create({
      data: {
        authProviderId: profile.sub,
        email: normalizedEmail,
        name: profile.name ?? null,
        avatarUrl: profile.picture ?? null,
      },
    });
  }
}