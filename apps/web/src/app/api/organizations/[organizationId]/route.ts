import { proxyAuthenticatedRequest } from '@/lib/api/proxy-request';

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { organizationId } = await context.params;
  return proxyAuthenticatedRequest(
    request,
    `/v1/organizations/${encodeURIComponent(organizationId)}`,
  );
}
