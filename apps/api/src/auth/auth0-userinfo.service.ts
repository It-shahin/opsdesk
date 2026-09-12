import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { Auth0UserProfile } from './auth.types.js';

const auth0UserInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean().default(false),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

@Injectable()
export class Auth0UserInfoService {
  private readonly userInfoUrl: string;

  constructor(private readonly configService: ConfigService) {
    const issuer = this.configService.getOrThrow<string>(
      'AUTH0_ISSUER_BASE_URL',
    );

    this.userInfoUrl = new URL('userinfo', issuer).toString();
  }

  async getUserProfile(
    accessToken: string,
    expectedSubject: string,
  ): Promise<Auth0UserProfile> {
    const response = await fetch(this.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException(
        'Unable to retrieve authenticated user profile',
      );
    }

    const data: unknown = await response.json();

    const result = auth0UserInfoSchema.safeParse(data);

    if (!result.success) {
      throw new UnauthorizedException(
        'Invalid user profile returned by identity provider',
      );
    }

    if (result.data.sub !== expectedSubject) {
      throw new UnauthorizedException(
        'Identity subject mismatch',
      );
    }

    return {
      sub: result.data.sub,
      email: result.data.email,
      emailVerified: result.data.email_verified,
      name: result.data.name,
      picture: result.data.picture,
    };
  }
}