import { proxyAuthenticatedRequest } from '@/lib/api/proxy-request';

type RouteContext = {
  params: Promise<{
    organizationId: string;
    invitationId: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const { organizationId, invitationId } = await context.params;
  return proxyAuthenticatedRequest(
    request,
    `/v1/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}`,
  );
}
