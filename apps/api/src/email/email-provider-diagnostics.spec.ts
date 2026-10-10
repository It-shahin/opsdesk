import { describe, expect, it } from '@jest/globals';
import { providerDiagnostic } from './email-provider-diagnostics.js';

describe('Safe provider diagnostics', () => {
  it('retains documented rejection codes and HTTP status', () => {
    expect(
      providerDiagnostic({ name: 'validation_error', statusCode: 403 }),
    ).toEqual({ providerCode: 'validation_error', providerStatus: 403 });
  });
  it.each([NaN, Infinity, 403.5, 200, 600, '403', undefined])(
    'withholds malformed statuses: %s',
    (statusCode) => {
      expect(providerDiagnostic({ statusCode }).providerStatus).toBeNull();
    },
  );
  it('withholds arbitrary provider names and ignores extra sensitive fields', () => {
    const failure = {
      name: 'private@example.test SECRET',
      statusCode: 403,
      message: 'recipient and private content',
      authorization: 'SECRET',
    };
    expect(providerDiagnostic(failure)).toEqual({
      providerCode: 'unknown_provider_error',
      providerStatus: 403,
    });
    expect(JSON.stringify(providerDiagnostic(failure))).not.toMatch(
      /SECRET|private/,
    );
  });
});
