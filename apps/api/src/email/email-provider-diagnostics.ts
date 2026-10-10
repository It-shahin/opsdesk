// Provider messages may include recipients, domains or credentials. Only emit
// documented error codes and a bounded HTTP status, never the raw message.
const CODES = new Set([
  'invalid_idempotency_key',
  'validation_error',
  'missing_api_key',
  'restricted_api_key',
  'invalid_permission',
  'suspended_api_key',
  'not_found',
  'method_not_allowed',
  'concurrent_idempotent_requests',
  'invalid_idempotent_request',
  'resource_locked',
  'invalid_attachment',
  'invalid_parameter',
  'missing_required_field',
  'missing_required_parameter',
  'daily_quota_exceeded',
  'monthly_quota_exceeded',
  'rate_limit_exceeded',
  'application_error',
  'service_unavailable',
]);

export function providerDiagnostic(error: {
  name?: unknown;
  statusCode?: unknown;
}) {
  return {
    providerCode:
      typeof error.name === 'string' && CODES.has(error.name)
        ? error.name
        : 'unknown_provider_error',
    providerStatus:
      typeof error.statusCode === 'number' &&
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
        ? error.statusCode
        : null,
  };
}

export type ProviderDiagnostic = ReturnType<typeof providerDiagnostic>;
