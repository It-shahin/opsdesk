import { Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Auth0UserInfoService } from './auth0-userinfo.service.js';

describe('Auth0UserInfoService', () => {
  const profile = {
    sub: 'auth0|fixture-user',
    email: 'agent@example.test',
    email_verified: true,
    name: 'Fixture Agent',
  };

  let service: Auth0UserInfoService;
  let fetchMock: ReturnType<typeof jest.spyOn<typeof globalThis, 'fetch'>>;

  beforeEach(() => {
    service = new Auth0UserInfoService({
      getOrThrow: () => 'https://identity.example.test/',
    } as unknown as ConfigService);
    fetchMock = jest.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValue(Response.json(profile));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shares parallel requests and caches the validated profile for one minute', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const results = await Promise.all([
      service.getUserProfile('token-a', profile.sub),
      service.getUserProfile('token-a', profile.sub),
      service.getUserProfile('token-a', profile.sub),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual({
      sub: profile.sub,
      email: profile.email,
      emailVerified: true,
      name: profile.name,
      picture: undefined,
    });
    expect(fetchMock).toHaveBeenCalledWith('https://identity.example.test/userinfo', {
      headers: { Authorization: 'Bearer token-a' },
      signal: expect.any(AbortSignal),
    });

    clock.mockReturnValue(60_999);
    await service.getUserProfile('token-a', profile.sub);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock.mockReturnValue(61_000);
    fetchMock.mockResolvedValueOnce(Response.json(profile));
    await service.getUserProfile('token-a', profile.sub);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a profile for another token', async () => {
    await service.getUserProfile('token-a', profile.sub);
    fetchMock.mockResolvedValueOnce(Response.json(profile));
    await service.getUserProfile('token-b', profile.sub);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('checks the subject on cached profiles and does not expose mutable cache data', async () => {
    const result = await service.getUserProfile('token-a', profile.sub);
    result.emailVerified = false;

    await expect(service.getUserProfile('token-a', 'auth0|another-user'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    const cached = await service.getUserProfile('token-a', profile.sub);
    expect(cached.emailVerified).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a subject mismatch before caching', async () => {
    await expect(service.getUserProfile('token-a', 'auth0|another-user'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    fetchMock.mockResolvedValueOnce(Response.json(profile));
    await service.getUserProfile('token-a', profile.sub);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('limits cache entries and refetches an evicted profile', async () => {
    fetchMock.mockImplementation(async () => Response.json(profile));
    for (let index = 0; index < 501; index += 1) {
      await service.getUserProfile(`token-${index}`, profile.sub);
    }
    await service.getUserProfile('token-0', profile.sub);
    expect(fetchMock).toHaveBeenCalledTimes(502);
  });

  it.each([429, 500, 503])('reports HTTP %s as provider unavailability and permits a fresh retry', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status }));
    await expect(service.getUserProfile('token-a', profile.sub))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(`Auth0 /userinfo returned HTTP ${status}`);

    await service.getUserProfile('token-a', profile.sub);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])('continues rejecting HTTP %s responses without caching', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status }));
    await expect(service.getUserProfile('token-a', profile.sub))
      .rejects.toBeInstanceOf(UnauthorizedException);
    await service.getUserProfile('token-a', profile.sub);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    { sub: profile.sub },
    { ...profile, email: 'invalid-email' },
  ])('rejects malformed identity profiles', async (data) => {
    fetchMock.mockResolvedValueOnce(Response.json(data));
    await expect(service.getUserProfile('token-a', profile.sub))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid JSON response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not-json'));
    await expect(service.getUserProfile('token-a', profile.sub))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('retains an unverified email for the existing UsersService verification check', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...profile, email_verified: false }));
    expect(await service.getUserProfile('token-a', profile.sub))
      .toMatchObject({ emailVerified: false });
  });

  it('handles network failures without caching the failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection failed'));
    await expect(service.getUserProfile('token-a', profile.sub))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    await service.getUserProfile('token-a', profile.sub);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
