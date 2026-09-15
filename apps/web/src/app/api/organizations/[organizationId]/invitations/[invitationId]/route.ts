import { NextResponse } from 'next/server';

import { auth0 } from '@/lib/auth0';

type RouteContext = {
  params: Promise<{
    organizationId: string;
    invitationId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const session =
    await auth0.getSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 },
    );
  }

  const {
    organizationId,
    invitationId,
  } = await context.params;

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
      { status: 500 },
    );
  }

  const response = await fetch(
    `${apiUrl}/v1/organizations/${organizationId}/invitations/${invitationId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
      cache: 'no-store',
    },
  );

  const data: unknown =
    await response.json();

  return NextResponse.json(
    data,
    {
      status: response.status,
    },
  );
}
