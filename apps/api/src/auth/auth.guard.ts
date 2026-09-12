import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  createRemoteJWKSet,
  jwtVerify,
} from 'jose';
import type { Request } from 'express';

import type {
  AuthenticatedRequest,
  AuthPrincipal,
} from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.issuer =
      this.configService.getOrThrow<string>('AUTH0_ISSUER_BASE_URL');

    this.audience =
      this.configService.getOrThrow<string>('AUTH0_AUDIENCE');

    this.jwks = createRemoteJWKSet(
      new URL('.well-known/jwks.json', this.issuer),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const { payload } = await jwtVerify(
        token,
        this.jwks,
        {
          issuer: this.issuer,
          audience: this.audience,
          algorithms: ['RS256'],
        },
      );

      if (!payload.sub) {
        throw new UnauthorizedException(
          'Access token does not contain a subject',
        );
      }

      request.auth = payload as AuthPrincipal;
      request.accessToken = token;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid access token');
    }
  }

  private extractBearerToken(
    request: Request,
  ): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }
}