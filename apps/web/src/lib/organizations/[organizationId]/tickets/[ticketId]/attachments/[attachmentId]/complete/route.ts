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

      attachmentId:
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
    attachmentId,
  } =
    await context.params;

  return proxyAuthenticatedRequest(
    request,

    `/v1/organizations/${encodeURIComponent(
      organizationId,
    )}/tickets/${encodeURIComponent(
      ticketId,
    )}/attachments/${encodeURIComponent(
      attachmentId,
    )}/complete`,
  );
}