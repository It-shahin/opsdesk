import { NextResponse } from 'next/server';

import { auth0 } from '@/lib/auth0';

export async function GET() {
  const session = await auth0.getSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 },
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
          'API_SERVER_URL is not configured',
      },
      { status: 500 },
    );
  }

  const response = await fetch(
    `${apiUrl}/v1/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    },
  );

  const data: unknown =
    await response.json();

  return NextResponse.json(data, {
    status: response.status,
  });
}