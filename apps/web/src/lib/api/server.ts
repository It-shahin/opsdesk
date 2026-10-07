import 'server-only';

import { AccessTokenError } from '@auth0/nextjs-auth0/errors';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import {
  auth0,
} from '@/lib/auth0';

// Layouts and pages can load data in parallel. Share one token lookup per render.
const getServerAccessToken = cache(async () => {
  try {
    return await auth0.getAccessToken();
  } catch (error) {
    if (!(error instanceof AccessTokenError)) {
      throw error;
    }
  }

  redirect('/auth/login?returnTo=/app');
});

export class ApiServerError
  extends Error {
  constructor(
    public readonly status:
      number,

    message:
      string,
  ) {
    super(
      message,
    );

    this.name =
      'ApiServerError';
  }
}

export async function apiServerFetch<
  T,
>(
  path:
    string,

  init:
    RequestInit = {},
): Promise<T> {
  const apiUrl =
    process.env
      .API_SERVER_URL;

  if (!apiUrl) {
    throw new Error(
      'API_SERVER_URL is not configured',
    );
  }

  const {
    token,
  } =
    await getServerAccessToken();

  const headers =
    new Headers(
      init.headers,
    );

  headers.set(
    'Authorization',
    `Bearer ${token}`,
  );

  if (
    init.body &&
    !headers.has(
      'Content-Type',
    )
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  const response =
    await fetch(
      `${apiUrl}${path}`,
      {
        ...init,

        headers,

        cache:
          'no-store',
      },
    );

  // A rejected session is recoverable; do not render the runtime error overlay.
  if (response.status === 401) {
    redirect('/auth/login?returnTo=/app');
  }

  if (
    response.status ===
    204
  ) {
    return undefined as T;
  }

  const data:
    unknown =
    await response
      .json()
      .catch(
        () => null,
      );

  if (
    !response.ok
  ) {
    const message =
      typeof data ===
        'object' &&
      data !== null &&
      'message' in data &&
      typeof (
        data as {
          message?:
            unknown;
        }
      ).message ===
        'string'
        ? (
            data as {
              message:
                string;
            }
          ).message
        : 'API request failed';

    throw new ApiServerError(
      response.status,
      message,
    );
  }

  return data as T;
}
