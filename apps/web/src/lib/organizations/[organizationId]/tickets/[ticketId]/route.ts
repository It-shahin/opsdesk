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
  } =
    await context.params;

  return proxyAuthenticatedGet(
    request,

    `/v1/organizations/${encodeURIComponent(
      organizationId,
    )}/tickets/${encodeURIComponent(
      ticketId,
    )}`,
  );
}