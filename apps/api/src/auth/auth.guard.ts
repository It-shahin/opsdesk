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
  type JWTPayload,
} from 'jose';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from './public.decorator.js';

type AuthenticatedRequest = Request & {
  auth?: JWTPayload;
};

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
      new URL(`${this.issuer}.well-known/jwks.json`),
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
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256'],
      });

      request.auth = payload;

      return true;
    } catch (error) {
  if (error instanceof Error) {
    console.error('JWT verification failed:', {
      name: error.name,
      message: error.message,
      code:
        'code' in error
          ? String(error.code)
          : undefined,
    });
  }

  throw new UnauthorizedException('Invalid access token');
}
  }

  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ');

    return type === 'Bearer' && token ? token : undefined;
  }
}