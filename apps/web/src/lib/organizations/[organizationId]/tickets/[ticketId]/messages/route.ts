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

async function path(
  context:
    RouteContext,
) {
  const {
    organizationId,
    ticketId,
  } =
    await context.params;

  return `/v1/organizations/${encodeURIComponent(
    organizationId,
  )}/tickets/${encodeURIComponent(
    ticketId,
  )}/messages`;
}

export async function GET(
  request:
    Request,

  context:
    RouteContext,
) {
  return proxyAuthenticatedRequest(
    request,
    await path(
      context,
    ),
  );
}

export async function POST(
  request:
    Request,

  context:
    RouteContext,
) {
  return proxyAuthenticatedRequest(
    request,
    await path(
      context,
    ),
  );
}