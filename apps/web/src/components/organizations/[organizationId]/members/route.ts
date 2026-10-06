import {
  proxyAuthenticatedGet,
} from '@/lib/api/proxy-get';

type RouteContext = {
  params:
    Promise<{
      organizationId:
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
  } =
    await context.params;

  return proxyAuthenticatedGet(
    request,

    `/v1/organizations/${encodeURIComponent(
      organizationId,
    )}/members`,
  );
}