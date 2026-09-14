import { NextResponse } from 'next/server';

import { auth0 } from '@/lib/auth0';

async function getApiContext() {
  const session = await auth0.getSession();

  if (!session) {
    return null;
  }

  const { token } = await auth0.getAccessToken();
  const apiUrl = process.env.API_SERVER_URL;

  if (!apiUrl) {
    throw new Error('API_SERVER_URL is not configured');
  }

  return {
    token,
    apiUrl,
  };
}

export async function GET() {
  const context = await getApiContext();

  if (!context) {
    return NextResponse.json(
      {
        error: 'Not authenticated',
      },
      {
        status: 401,
      },
    );
  }

  const response = await fetch(
    `${context.apiUrl}/v1/organizations`,
    {
      headers: {
        Authorization: `Bearer ${context.token}`,
      },
      cache: 'no-store',
    },
  );

  const data: unknown = await response.json();

  return NextResponse.json(data, {
    status: response.status,
  });
}

export async function POST(request: Request) {
  const context = await getApiContext();

  if (!context) {
    return NextResponse.json(
      {
        error: 'Not authenticated',
      },
      {
        status: 401,
      },
    );
  }

  const body: unknown = await request.json();

  const response = await fetch(
    `${context.apiUrl}/v1/organizations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );

  const data: unknown = await response.json();

  return NextResponse.json(data, {
    status: response.status,
  });
}
