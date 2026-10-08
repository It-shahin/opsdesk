import { proxyAuthenticatedRequest } from '@/lib/api/proxy-request';

export async function GET(request: Request) {
  return proxyAuthenticatedRequest(request, '/v1/organizations');
}

export async function POST(request: Request) {
  return proxyAuthenticatedRequest(request, '/v1/organizations');
}
