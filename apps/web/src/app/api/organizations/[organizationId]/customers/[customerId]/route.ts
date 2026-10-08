import { proxyAuthenticatedRequest } from '@/lib/api/proxy-request';

type RouteContext = {
  params: Promise<{
    organizationId: string;
    customerId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { organizationId, customerId } = await context.params;
  return proxyAuthenticatedRequest(
    request,
    `/v1/organizations/${encodeURIComponent(organizationId)}/customers/${encodeURIComponent(customerId)}`,
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { organizationId, customerId } = await context.params;
  return proxyAuthenticatedRequest(
    request,
    `/v1/organizations/${encodeURIComponent(organizationId)}/customers/${encodeURIComponent(customerId)}`,
  );
}
