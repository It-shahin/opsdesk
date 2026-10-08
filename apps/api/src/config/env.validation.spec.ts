import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { validateEnv } from './env.validation.js';

const validEnv = {
  NODE_ENV: 'production',
  WEB_ORIGIN: 'https://opsdesk.example.test',
  DATABASE_URL: 'postgresql://localhost/opsdesk',
  REDIS_URL: 'redis://localhost:6379',
  AUTH0_ISSUER_BASE_URL: 'https://tenant.auth0.com/',
  AUTH0_AUDIENCE: 'https://api.opsdesk.example.test',
  R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  R2_BUCKET: 'test-bucket',
  R2_ACCESS_KEY_ID: 'test-key',
  R2_SECRET_ACCESS_KEY: 'test-secret',
  RESEND_API_KEY: 'test-key',
  RESEND_INBOUND_API_KEY: 'test-key',
  RESEND_WEBHOOK_SECRET: 'test-secret',
  EMAIL_FROM_NAME: 'OpsDesk',
  EMAIL_FROM_ADDRESS: 'support@example.test',
  EMAIL_INBOUND_DOMAIN: 'inbound.example.test',
};

describe('environment validation', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts HTTPS production services and private database/cache connections', () => {
    expect(validateEnv(validEnv)).toMatchObject(validEnv);
  });

  it.each(['development', 'test'])(
    'permits local HTTP services in %s',
    (NODE_ENV) => {
      expect(
        validateEnv({
          ...validEnv,
          NODE_ENV,
          WEB_ORIGIN: 'http://localhost:3000',
          AUTH0_ISSUER_BASE_URL: 'http://localhost:4000',
          R2_ENDPOINT: 'http://localhost:9000',
        }).NODE_ENV,
      ).toBe(NODE_ENV);
    },
  );

  it.each(['WEB_ORIGIN', 'AUTH0_ISSUER_BASE_URL', 'R2_ENDPOINT'])(
    'rejects HTTP %s in production',
    (field) => {
      expect(() =>
        validateEnv({ ...validEnv, [field]: 'http://localhost:3000' }),
      ).toThrow('Invalid environment configuration');
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({
          [field]: expect.arrayContaining([
            expect.stringContaining('HTTPS in production'),
          ]),
        }),
      );
    },
  );

  it.each(['/dashboard', '/?view=open', '/#tickets'])(
    'rejects a WEB_ORIGIN suffix %s in development too',
    (suffix) => {
      expect(() =>
        validateEnv({
          ...validEnv,
          NODE_ENV: 'development',
          WEB_ORIGIN: `http://localhost:3000${suffix}`,
        }),
      ).toThrow('Invalid environment configuration');
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({
          WEB_ORIGIN: [
            'WEB_ORIGIN must be an origin without a path, query or fragment',
          ],
        }),
      );
    },
  );

  it.each(['WEB_ORIGIN', 'AUTH0_ISSUER_BASE_URL', 'R2_ENDPOINT'])(
    'reports a malformed %s without leaking a URL constructor exception',
    (field) => {
      expect(() => validateEnv({ ...validEnv, [field]: 'not-a-url' })).toThrow(
        'Invalid environment configuration',
      );
    },
  );
});
