import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import type {
  Request,
} from 'express';

import type {
  AuthenticatedRequest,
} from './auth.types.js';

import {
  AccessTokenVerifierService,
} from './access-token-verifier.service.js';

import {
  IS_PUBLIC_KEY,
} from './public.decorator.js';

@Injectable()
export class AuthGuard
  implements CanActivate
{
  constructor(
    private readonly reflector:
      Reflector,

    private readonly accessTokens:
      AccessTokenVerifierService,
  ) {}

  async canActivate(
    context:
      ExecutionContext,
  ): Promise<boolean> {
    const isPublic =
      this.reflector
        .getAllAndOverride<boolean>(
          IS_PUBLIC_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    if (
      isPublic
    ) {
      return true;
    }

    /*
     * WebSocket authentication is
     * handled at the Socket.IO
     * handshake boundary.
     */
    if (
      context.getType() !==
      'http'
    ) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<
          AuthenticatedRequest
        >();

    const token =
      this.extractBearerToken(
        request,
      );

    if (!token) {
      throw new UnauthorizedException(
        'Missing access token',
      );
    }

    const principal =
      await this.accessTokens
        .verify(
          token,
        );

    request.auth =
      principal;

    request.accessToken =
      token;

    return true;
  }

  private extractBearerToken(
    request:
      Request,
  ): string | undefined {
    const authorization =
      request.headers
        .authorization;

    if (!authorization) {
      return undefined;
    }

    const [
      type,
      token,
    ] =
      authorization.split(
        ' ',
      );

    if (
      type !== 'Bearer' ||
      !token
    ) {
      return undefined;
    }

    return token;
  }
}