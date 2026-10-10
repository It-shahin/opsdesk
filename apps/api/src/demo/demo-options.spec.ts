import { describe, expect, it } from '@jest/globals';
import {
  assertSafeDemoTarget,
  DEMO_SLUG,
  parseDemoOptions,
  type DemoOptions,
} from './demo-options.js';

const localEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://demo:demo@127.0.0.1:5432/opsdesk_demo_test',
};
const options = (): DemoOptions =>
  parseDemoOptions([
    '--target',
    'local',
    '--owner-email',
    'Owner@EXAMPLE.COM',
    '--confirm-demo-seed',
  ]);
const stagingEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://demo:demo@postgres.railway.internal:5432/railway',
  RAILWAY_ENVIRONMENT_NAME: 'staging',
  RAILWAY_PROJECT_ID: 'project-staging',
  RAILWAY_ENVIRONMENT_ID: 'env-staging',
  DEMO_STAGING_PROJECT_ID: 'project-staging',
  DEMO_STAGING_ENVIRONMENT_ID: 'env-staging',
  DEMO_STAGING_DATABASE_HOST: 'postgres.railway.internal',
  DEMO_STAGING_DATABASE_PORT: '5432',
  DEMO_STAGING_DATABASE_NAME: 'railway',
};
const stagingOptions = (): DemoOptions => ({
  ...options(),
  target: 'railway-staging',
  railwayProjectId: 'project-staging',
  railwayEnvironmentId: 'env-staging',
});

describe('Manual demo command and production safeguards', () => {
  it('requires a target and exactly one explicit owner, normalizing emails', () => {
    expect(options().owner).toEqual({ email: 'owner@example.com' });
    expect(() =>
      parseDemoOptions(['--owner-email', 'owner@example.com']),
    ).toThrow('target');
    expect(() => parseDemoOptions(['--target', 'local'])).toThrow(
      'exactly one',
    );
    expect(() =>
      parseDemoOptions([
        '--target',
        'local',
        '--owner-email',
        'a@example.com',
        '--owner-user-id',
        '123',
      ]),
    ).toThrow('exactly one');
    expect(() =>
      parseDemoOptions(['--target', 'local', '--owner-user-id', '123']),
    ).toThrow('UUID');
    expect(() =>
      parseDemoOptions(['--target', 'local', '--owner-email', 'invalid']),
    ).toThrow('email');
    expect(() =>
      parseDemoOptions([
        '--target',
        'local',
        '--owner-email',
        'a@example.com',
        '--unknown',
      ]),
    ).toThrow();
  });

  it('accepts local loopback only after explicit confirmation', () => {
    expect(assertSafeDemoTarget(options(), localEnv)).toBe(
      localEnv.DATABASE_URL,
    );
    expect(() =>
      assertSafeDemoTarget({ ...options(), confirmSeed: false }, localEnv),
    ).toThrow('confirm-demo-seed');
    expect(() =>
      assertSafeDemoTarget({ ...options(), action: 'reset' }, localEnv),
    ).toThrow('confirm-demo-reset');
    expect(() =>
      assertSafeDemoTarget(
        { ...options(), action: 'reset', confirmReset: 'other-tenant' },
        localEnv,
      ),
    ).toThrow('confirm-demo-reset');
    expect(
      assertSafeDemoTarget(
        { ...options(), action: 'reset', confirmReset: DEMO_SLUG },
        localEnv,
      ),
    ).toBe(localEnv.DATABASE_URL);
  });

  it.each([
    { NODE_ENV: 'production' },
    { NODE_ENV: '' },
    { APP_ENV: 'production' },
    { ENVIRONMENT: 'prod' },
    { DEPLOYMENT_ENV: 'opsdesk-production' },
    { RAILWAY_PROJECT_ID: 'any-project' },
    { RAILWAY_ENVIRONMENT_NAME: 'production' },
    { DATABASE_URL: 'postgresql://demo:demo@db.example.com/demo' },
    { DATABASE_URL: 'postgresql://demo:demo@production.railway.internal/demo' },
    { DATABASE_URL: 'postgresql://demo:demo@127.0.0.1/opsdesk_production' },
    {
      DATABASE_URL: 'postgresql://demo:demo@127.0.0.1/demo?host=db.example.com',
    },
    {
      DATABASE_URL:
        'postgresql://demo:demo@127.0.0.1/demo?options=-c%20search_path=public',
    },
    { DATABASE_URL: 'postgresql://demo:demo@127.0.0.1/demo?schema=public' },
    { DATABASE_URL: 'mysql://demo:demo@127.0.0.1/demo' },
    { DATABASE_URL: 'invalid' },
  ])('rejects unsafe local execution: %j', (override) => {
    expect(() =>
      assertSafeDemoTarget(options(), { ...localEnv, ...override }),
    ).toThrow();
  });

  it('permits explicitly identified Railway staging with production runtime mode', () => {
    expect(assertSafeDemoTarget(stagingOptions(), stagingEnv)).toBe(
      stagingEnv.DATABASE_URL,
    );
  });

  it.each([
    { RAILWAY_ENVIRONMENT_NAME: 'production' },
    { RAILWAY_ENVIRONMENT_NAME: 'preview' },
    { RAILWAY_ENVIRONMENT_ID: 'another-env' },
    { RAILWAY_PROJECT_ID: 'another-project' },
    { DEMO_STAGING_ENVIRONMENT_ID: '' },
    { DEMO_STAGING_PROJECT_ID: '' },
    { DEMO_STAGING_DATABASE_HOST: 'production.railway.internal' },
    { DEMO_STAGING_DATABASE_PORT: '5433' },
    { DEMO_STAGING_DATABASE_NAME: 'another-db' },
    {
      DATABASE_URL: 'postgresql://demo:demo@127.0.0.1:5432/railway',
      DEMO_STAGING_DATABASE_HOST: '127.0.0.1',
    },
  ])('rejects unsafe staging execution: %j', (override) => {
    expect(() =>
      assertSafeDemoTarget(stagingOptions(), { ...stagingEnv, ...override }),
    ).toThrow();
  });

  it('requires staging IDs in the manual command as well as the environment', () => {
    expect(() =>
      assertSafeDemoTarget(
        { ...stagingOptions(), railwayProjectId: undefined },
        stagingEnv,
      ),
    ).toThrow('allowlists');
    expect(() =>
      assertSafeDemoTarget(
        { ...stagingOptions(), railwayEnvironmentId: 'production' },
        stagingEnv,
      ),
    ).toThrow('allowlists');
  });

  it('supports deterministic non-future dates and rejects rollover dates', () => {
    const args = [
      '--target',
      'local',
      '--owner-email',
      'a@example.com',
      '--as-of',
    ];
    expect(parseDemoOptions([...args, '2026-01-10']).asOf?.toISOString()).toBe(
      '2026-01-10T00:00:00.000Z',
    );
    for (const value of ['2026-02-30', '2026-13-01', '2100-01-01', 'nonsense'])
      expect(() => parseDemoOptions([...args, value])).toThrow('as-of');
  });
});
