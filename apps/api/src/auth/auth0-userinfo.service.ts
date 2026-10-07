import { createHash } from 'node:crypto';

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
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
  private readonly logger = new Logger(Auth0UserInfoService.name);
  private readonly profiles = new Map<
    string,
    { profile: Auth0UserProfile; expiresAt: number }
  >();
  private readonly inFlight = new Map<string, Promise<Auth0UserProfile>>();
  private readonly profileTtlMs = 60_000;
  private readonly maxCachedProfiles = 500;

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
    // Tokens are verified by the authentication guard before reaching here.
    // Keep cache entries specific to a token without storing the token itself.
    const key = createHash('sha256').update(accessToken).digest('hex');
    const cached = this.profiles.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      this.assertSubject(cached.profile, expectedSubject);
      return { ...cached.profile };
    }

    this.profiles.delete(key);

    let request = this.inFlight.get(key);

    if (!request) {
      request = this.fetchUserProfile(accessToken);
      this.inFlight.set(key, request);
    }

    try {
      const profile = await request;
      this.assertSubject(profile, expectedSubject);

      for (const [cachedKey, entry] of this.profiles) {
        if (entry.expiresAt <= Date.now()) {
          this.profiles.delete(cachedKey);
        }
      }

      if (!this.profiles.has(key) && this.profiles.size >= this.maxCachedProfiles) {
        const oldestKey = this.profiles.keys().next().value;
        if (oldestKey !== undefined) this.profiles.delete(oldestKey);
      }

      this.profiles.set(key, {
        profile,
        expiresAt: Date.now() + this.profileTtlMs,
      });

      return { ...profile };
    } finally {
      if (this.inFlight.get(key) === request) {
        this.inFlight.delete(key);
      }
    }
  }

  private async fetchUserProfile(accessToken: string): Promise<Auth0UserProfile> {
    let response: Response;

    try {
      response = await fetch(this.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      this.logger.warn('Auth0 /userinfo request failed before receiving a response');
      throw new ServiceUnavailableException(
        'Identity provider is temporarily unavailable',
      );
    }

    if (!response.ok) {
      // Do not log tokens or profile response bodies.
      this.logger.warn(`Auth0 /userinfo returned HTTP ${response.status}`);

      if (response.status === 429 || response.status >= 500) {
        throw new ServiceUnavailableException(
          'Identity provider is temporarily unavailable',
        );
      }

      throw new UnauthorizedException(
        'Unable to retrieve authenticated user profile',
      );
    }

    const data: unknown = await response.json().catch(() => null);

    const result = auth0UserInfoSchema.safeParse(data);

    if (!result.success) {
      throw new UnauthorizedException(
        'Invalid user profile returned by identity provider',
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

  private assertSubject(profile: Auth0UserProfile, expectedSubject: string): void {
    if (profile.sub !== expectedSubject) {
      throw new UnauthorizedException('Identity subject mismatch');
    }
  }
}
