import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';
const realtimeOrigin = new URL(
  process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:3001',
).origin;
const realtimeWsOrigin = realtimeOrigin.replace(/^http/, 'ws');
const r2Origin = process.env.NEXT_PUBLIC_R2_ORIGIN;
const connectSources = [
  "'self'",
  realtimeOrigin,
  realtimeWsOrigin,
  ...(r2Origin ? [new URL(r2Origin).origin] : []),
  ...(isProduction ? [] : ['ws:', 'http:']),
].join(' ');

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src ${connectSources}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Include local cookie preferences and the separate realtime token route.
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
};

export default nextConfig;
