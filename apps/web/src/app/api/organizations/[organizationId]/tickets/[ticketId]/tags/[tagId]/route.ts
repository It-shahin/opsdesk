import { proxyAuthenticatedRequest } from '@/lib/api/proxy-request';

type RouteContext = {
  params: Promise<{
    organizationId: string;
    ticketId: string;
    tagId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { organizationId, ticketId, tagId } = await context.params;
  return proxyAuthenticatedRequest(
    request,
    `/v1/organizations/${encodeURIComponent(organizationId)}/tickets/${encodeURIComponent(ticketId)}/tags/${encodeURIComponent(tagId)}`,
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const { organizationId, ticketId, tagId } = await context.params;
  return proxyAuthenticatedRequest(
    request,
    `/v1/organizations/${encodeURIComponent(organizationId)}/tickets/${encodeURIComponent(ticketId)}/tags/${encodeURIComponent(tagId)}`,
  );
}
