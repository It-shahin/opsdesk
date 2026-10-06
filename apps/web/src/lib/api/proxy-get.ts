import 'server-only';

import {
  NextResponse,
} from 'next/server';

import {
  auth0,
} from '@/lib/auth0';

export async function proxyAuthenticatedGet(
  request:
    Request,

  path:
    string,
) {
  const session =
    await auth0
      .getSession();

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
    await auth0
      .getAccessToken();

  const apiUrl =
    process.env
      .API_SERVER_URL;

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

  const incomingUrl =
    new URL(
      request.url,
    );

  const query =
    incomingUrl
      .searchParams
      .toString();

  const upstreamUrl =
    `${apiUrl}${path}${
      query
        ? `?${query}`
        : ''
    }`;

  const response =
    await fetch(
      upstreamUrl,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        cache:
          'no-store',
      },
    );

  const body =
    await response
      .text();

  return new NextResponse(
    body ||
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