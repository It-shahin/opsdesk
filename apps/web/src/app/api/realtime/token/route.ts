import {
  NextResponse,
} from 'next/server';

import {
  auth0,
} from '@/lib/auth0';

export const dynamic =
  'force-dynamic';

export async function GET() {
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

  try {
    const {
      token,
    } =
      await auth0
        .getAccessToken();

    return NextResponse.json(
      {
        token,
      },
      {
        headers: {
          'Cache-Control':
            'no-store, private',
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          'Could not obtain realtime access token',
      },
      {
        status:
          401,
      },
    );
  }
}