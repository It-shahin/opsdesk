import 'server-only';

import {
  NextResponse,
} from 'next/server';

import {
  auth0,
} from '@/lib/auth0';

export async function proxyAuthenticatedRequest(
  request:
    Request,

  path:
    string,
) {
  const session =
    await auth0.getSession();

  if (!session) {
    return NextResponse.json(
      {
        error:
          'Not authenticated',
      },
      {
        status:
          401,
      },
    );
  }

  const {
    token,
  } =
    await auth0.getAccessToken();

  const apiUrl =
    process.env.API_SERVER_URL;

  if (!apiUrl) {
    return NextResponse.json(
      {
        error:
          'API_SERVER_URL is not configured',
      },
      {
        status:
          500,
      },
    );
  }

  const sourceUrl =
    new URL(
      request.url,
    );

  const headers =
    new Headers();

  headers.set(
    'Authorization',
    `Bearer ${token}`,
  );

  const contentType =
    request.headers.get(
      'content-type',
    );

  if (
    contentType
  ) {
    headers.set(
      'Content-Type',
      contentType,
    );
  }

  const method =
    request.method
      .toUpperCase();

  let body:
    string |
    undefined;

  if (
    method !==
      'GET' &&
    method !==
      'HEAD'
  ) {
    const raw =
      await request.text();

    body =
      raw ||
      undefined;
  }

  const response =
    await fetch(
      `${apiUrl}${path}${sourceUrl.search}`,
      {
        method,

        headers,

        body,

        cache:
          'no-store',
      },
    );

  const responseBody =
    await response.text();

  return new NextResponse(
    responseBody ||
      null,
    {
      status:
        response.status,

      headers: {
        'Content-Type':
          response.headers
            .get(
              'content-type',
            ) ??
          'application/json',
      },
    },
  );
}