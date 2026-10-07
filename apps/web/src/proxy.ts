import { AccessTokenError } from '@auth0/nextjs-auth0/errors';
import { NextRequest, NextResponse } from 'next/server';

import { auth0 } from './lib/auth0';

export async function proxy(request: NextRequest) {
  const response = await auth0.middleware(request);
  const { pathname, search } = request.nextUrl;

  if (pathname === '/app' || pathname.startsWith('/app/')) {
    try {
      // Server Components cannot save rotated refresh tokens. Renew here so
      // Next.js receives the updated session cookie before rendering the page.
      await auth0.getAccessToken(request, response);
    } catch (error) {
      if (!(error instanceof AccessTokenError)) {
        throw error;
      }

      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('returnTo', `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
