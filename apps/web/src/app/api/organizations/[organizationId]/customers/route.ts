import { NextResponse } from 'next/server';

import { auth0 } from '@/lib/auth0';

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

async function getContext(
  context: RouteContext,
) {
  const session =
    await auth0.getSession();

  if (!session) {
    return null;
  }

  const { organizationId } =
    await context.params;

  const { token } =
    await auth0.getAccessToken();

  const apiUrl =
    process.env.API_SERVER_URL;

  if (!apiUrl) {
    throw new Error(
      'API_SERVER_URL is not configured',
    );
  }

  return {
    organizationId,
    token,
    apiUrl,
  };
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const api =
    await getContext(context);

  if (!api) {
    return NextResponse.json(
      {
        error:
          'Not authenticated',
      },
      {
        status: 401,
      },
    );
  }

  const response = await fetch(
    `${api.apiUrl}/v1/organizations/${api.organizationId}/customers`,
    {
      headers: {
        Authorization:
          `Bearer ${api.token}`,
      },

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

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const api =
    await getContext(context);

  if (!api) {
    return NextResponse.json(
      {
        error:
          'Not authenticated',
      },
      {
        status: 401,
      },
    );
  }

  const body: unknown =
    await request.json();

  const response = await fetch(
    `${api.apiUrl}/v1/organizations/${api.organizationId}/customers`,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${api.token}`,

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