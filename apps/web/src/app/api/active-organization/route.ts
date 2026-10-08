import {
  NextResponse,
} from 'next/server';

import {
  auth0,
} from '@/lib/auth0';

import { validateMutationOrigin } from '@/lib/api/proxy-request';

import {
  ApiServerError,
  apiServerFetch,
} from '@/lib/api/server';

import {
  ACTIVE_ORGANIZATION_COOKIE,
} from '@/lib/organizations/constants';

import type {
  Organization,
} from '@/lib/organizations/types';

export async function POST(
  request:
    Request,
) {
  const originError = validateMutationOrigin(request);
  if (originError) return originError;

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

  let body:
    unknown;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          'Invalid request body',
      },
      {
        status:
          400,
      },
    );
  }

  const organizationId =
    typeof body ===
      'object' &&
    body !== null &&
    'organizationId'
      in body &&
    typeof (
      body as {
        organizationId?:
          unknown;
      }
    ).organizationId ===
      'string'
      ? (
          body as {
            organizationId:
              string;
          }
        ).organizationId
      : null;

  if (
    !organizationId
  ) {
    return NextResponse.json(
      {
        error:
          'organizationId is required',
      },
      {
        status:
          400,
      },
    );
  }

  try {
    /*
     * Validate membership through
     * the real Nest tenant guard
     * before persisting the
     * preference.
     */
    await apiServerFetch<
      Organization
    >(
      `/v1/organizations/${encodeURIComponent(
        organizationId,
      )}`,
    );
  } catch (error) {
    if (
      error instanceof
        ApiServerError
    ) {
      return NextResponse.json(
        {
          error:
            error.status ===
            404
              ? 'Organization not found'
              : error.message,
        },
        {
          status:
            error.status,
        },
      );
    }

    throw error;
  }

  const response =
    NextResponse.json({
      ok:
        true,
  });

  response.cookies.set(
    ACTIVE_ORGANIZATION_COOKIE,
    organizationId,
    {
      httpOnly:
        true,

      sameSite:
        'lax',

      secure:
        process.env.NODE_ENV ===
        'production',

      path:
        '/',

      maxAge:
        60 *
        60 *
        24 *
        365,
    },
  );

  return response;
}
