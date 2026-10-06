import {
  proxyAuthenticatedGet,
} from '@/lib/api/proxy-get';

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

export async function GET(
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

  return proxyAuthenticatedGet(
    request,

    `/v1/organizations/${encodeURIComponent(
      organizationId,
    )}/tickets/${encodeURIComponent(
      ticketId,
    )}/attachments/${encodeURIComponent(
      attachmentId,
    )}/download`,
  );
}