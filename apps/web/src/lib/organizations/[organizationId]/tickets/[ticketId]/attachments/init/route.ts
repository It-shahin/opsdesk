import {
  proxyAuthenticatedRequest,
} from '@/lib/api/proxy-request';

type RouteContext = {
  params:
    Promise<{
      organizationId:
        string;

      ticketId:
        string;
    }>;
};

export async function POST(
  request:
    Request,

  context:
    RouteContext,
) {
  const {
    organizationId,
    ticketId,
  } =
    await context.params;

  return proxyAuthenticatedRequest(
    request,

    `/v1/organizations/${encodeURIComponent(
      organizationId,
    )}/tickets/${encodeURIComponent(
      ticketId,
    )}/attachments/init`,
  );
}