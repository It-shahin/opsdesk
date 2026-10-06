import 'server-only';

import {
  auth0,
} from '@/lib/auth0';

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
    await auth0
      .getAccessToken();

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