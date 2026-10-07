import {
  proxyAuthenticatedRequest,
} from './proxy-request';

export function proxyAuthenticatedGet(
  request:
    Request,

  path:
    string,
) {
  return proxyAuthenticatedRequest(
    request,
    path,
  );
}