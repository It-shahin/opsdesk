import { NextResponse } from 'next/server';

import { auth0 } from '@/lib/auth0';

export async function POST(
  request: Request,
) {
  const session =
    await auth0.getSession();

  if (!session) {
    return NextResponse.json(
      {
        error: 'Not authenticated',
      },
      {
        status: 401,
      },
    );
  }

  const { token } =
    await auth0.getAccessToken();

  const apiUrl =
    process.env.API_SERVER_URL;

  if (!apiUrl) {
    return NextResponse.json(
      {
        error:
          'API server is not configured',
      },
      {
        status: 500,
      },
    );
  }

  const body: unknown =
    await request.json();

  const response =
    await fetch(
      `${apiUrl}/v1/invitations/accept`,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${token}`,

          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify(body),

        cache: 'no-store',
      },
    );

  const data: unknown =
    await response.json();

  return NextResponse.json(
    data,
    {
      status:
        response.status,
    },
  );
}