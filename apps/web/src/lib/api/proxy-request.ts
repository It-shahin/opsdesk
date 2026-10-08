import 'server-only';

import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

const privateHeaders = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
};

function isSafeMethod(method: string) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

export function validateMutationOrigin(request: Request): NextResponse | null {
  if (isSafeMethod(request.method.toUpperCase())) return null;

  const appBaseUrl = process.env.APP_BASE_URL;
  let expectedOrigin: string;
  try {
    if (!appBaseUrl) throw new Error('Missing APP_BASE_URL');
    expectedOrigin = new URL(appBaseUrl).origin;
  } catch {
    return NextResponse.json(
      { error: 'APP_BASE_URL is not configured' },
      { status: 500, headers: privateHeaders },
    );
  }

  const origin = request.headers.get('origin');
  if (!origin || origin !== expectedOrigin) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403, headers: privateHeaders },
    );
  }
  return null;
}

export async function proxyAuthenticatedRequest(
  request: Request,
  path: string,
) {
  const originError = validateMutationOrigin(request);
  if (originError) return originError;

  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401, headers: privateHeaders },
    );
  }

  const { token } = await auth0.getAccessToken();
  const apiUrl = process.env.API_SERVER_URL;
  if (!apiUrl) {
    return NextResponse.json(
      { error: 'API_SERVER_URL is not configured' },
      { status: 500, headers: privateHeaders },
    );
  }

  const sourceUrl = new URL(request.url);
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const method = request.method.toUpperCase();
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = (await request.text()) || undefined;
  }

  const response = await fetch(`${apiUrl}${path}${sourceUrl.search}`, {
    method,
    headers,
    body,
    cache: 'no-store',
  });
  const responseBody = await response.text();
  const responseHeaders = new Headers(privateHeaders);
  responseHeaders.set(
    'Content-Type',
    response.headers.get('content-type') ?? 'application/json',
  );
  for (const [name, value] of response.headers) {
    const normalized = name.toLowerCase();
    if (normalized === 'retry-after' || normalized.startsWith('x-ratelimit-')) {
      responseHeaders.set(name, value);
    }
  }

  return new NextResponse(responseBody || null, {
    status: response.status,
    headers: responseHeaders,
  });
}
