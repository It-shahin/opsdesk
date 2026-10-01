import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  createRemoteJWKSet,
  jwtVerify,
} from 'jose';

import type {
  AuthPrincipal,
} from './auth.types.js';

@Injectable()
export class AccessTokenVerifierService {
  private readonly issuer:
    string;

  private readonly audience:
    string;

  private readonly jwks:
    ReturnType<
      typeof createRemoteJWKSet
    >;

  constructor(
    configService:
      ConfigService,
  ) {
    this.issuer =
      configService
        .getOrThrow<string>(
          'AUTH0_ISSUER_BASE_URL',
        );

    this.audience =
      configService
        .getOrThrow<string>(
          'AUTH0_AUDIENCE',
        );

    this.jwks =
      createRemoteJWKSet(
        new URL(
          '.well-known/jwks.json',
          this.issuer,
        ),
      );
  }

  async verify(
    token: string,
  ): Promise<AuthPrincipal> {
    try {
      const {
        payload,
      } =
        await jwtVerify(
          token,
          this.jwks,
          {
            issuer:
              this.issuer,

            audience:
              this.audience,

            algorithms: [
              'RS256',
            ],
          },
        );

      if (
        !payload.sub
      ) {
        throw new UnauthorizedException(
          'Access token does not contain a subject',
        );
      }

      return payload as AuthPrincipal;
    } catch (error) {
      if (
        error instanceof
        UnauthorizedException
      ) {
        throw error;
      }

      throw new UnauthorizedException(
        'Invalid access token',
      );
    }
  }
}