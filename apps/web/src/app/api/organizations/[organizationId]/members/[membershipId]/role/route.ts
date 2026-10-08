import { proxyAuthenticatedRequest } from '@/lib/api/proxy-request';

type RouteContext = {
  params: Promise<{
    organizationId: string;
    membershipId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { organizationId, membershipId } = await context.params;
  return proxyAuthenticatedRequest(
    request,
    `/v1/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(membershipId)}/role`,
  );
}
