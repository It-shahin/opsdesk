import { parseArgs } from 'node:util';

export type DemoOptions = {
  action: 'seed' | 'validate' | 'reset';
  target: 'local' | 'railway-staging';
  owner: { email: string } | { id: string } | { authProviderId: string };
  asOf?: Date;
  confirmSeed: boolean;
  confirmReset?: string;
  railwayProjectId?: string;
  railwayEnvironmentId?: string;
};

export const DEMO_SLUG = 'northstar-support-demo-v1';
export const DEMO_NAME = 'Northstar Support [DEMO]';

export function parseDemoOptions(args: string[]): DemoOptions {
  const { values } = parseArgs({
    args,
    options: {
      action: { type: 'string', default: 'seed' },
      target: { type: 'string' },
      'owner-email': { type: 'string' },
      'owner-user-id': { type: 'string' },
      'owner-auth-provider-id': { type: 'string' },
      'as-of': { type: 'string' },
      'confirm-demo-seed': { type: 'boolean', default: false },
      'confirm-demo-reset': { type: 'string' },
      'railway-project-id': { type: 'string' },
      'railway-environment-id': { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!['seed', 'validate', 'reset'].includes(values.action!))
    throw new Error('Action must be seed, validate or reset');
  if (!['local', 'railway-staging'].includes(values.target ?? ''))
    throw new Error('Explicit --target local or railway-staging is required');
  const selectors = [
    values['owner-email'],
    values['owner-user-id'],
    values['owner-auth-provider-id'],
  ];
  if (selectors.filter((value) => value?.trim()).length !== 1)
    throw new Error(
      'Provide exactly one explicit owner email, user ID or Auth0 subject',
    );
  const owner: DemoOptions['owner'] = values['owner-email']
    ? { email: values['owner-email'].trim().toLowerCase() }
    : values['owner-user-id']
      ? { id: values['owner-user-id'].trim() }
      : { authProviderId: values['owner-auth-provider-id']!.trim() };
  if ('email' in owner && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email))
    throw new Error('Owner email is invalid');
  if (
    'id' in owner &&
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(owner.id)
  )
    throw new Error('Owner user ID must be a UUID');
  let asOf: Date | undefined;
  if (values['as-of']) {
    const value = values['as-of'];
    asOf = new Date(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(asOf.getTime()) ||
      asOf.toISOString().slice(0, 10) !== value ||
      asOf.getTime() > Date.now()
    )
      throw new Error(
        '--as-of must be a valid non-future UTC date (YYYY-MM-DD)',
      );
    if (values.action !== 'seed')
      throw new Error('--as-of applies only to seed');
  }
  return {
    action: values.action as DemoOptions['action'],
    target: values.target as DemoOptions['target'],
    owner,
    asOf,
    confirmSeed: values['confirm-demo-seed'],
    confirmReset: values['confirm-demo-reset'],
    railwayProjectId: values['railway-project-id'],
    railwayEnvironmentId: values['railway-environment-id'],
  };
}

// Validate before constructing a client or opening any connection. NODE_ENV is
// a build/runtime mode; Railway staging intentionally also uses production mode.
export function assertSafeDemoTarget(
  options: DemoOptions,
  env: NodeJS.ProcessEnv,
): string {
  if (options.action === 'seed' && options.confirmSeed !== true)
    throw new Error('Seed requires --confirm-demo-seed');
  if (options.action === 'reset' && options.confirmReset !== DEMO_SLUG)
    throw new Error(`Reset requires --confirm-demo-reset ${DEMO_SLUG}`);
  for (const key of [
    'APP_ENV',
    'ENVIRONMENT',
    'DEPLOYMENT_ENV',
    'RAILWAY_ENVIRONMENT_NAME',
  ]) {
    if (env[key] && /(?:^|[^a-z])prod(?:uction)?(?:$|[^a-z])/i.test(env[key]!))
      throw new Error('Production targets are forbidden');
  }
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL ?? '');
  } catch {
    throw new Error('A valid DATABASE_URL is required');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !url.username
  )
    throw new Error('Only explicit PostgreSQL connection URLs are supported');
  // libpq query parameters can override the host/database or search_path.
  if ([...url.searchParams.keys()].some((key) => key !== 'sslmode'))
    throw new Error(
      'DATABASE_URL query parameters other than sslmode are forbidden',
    );
  const database = decodeURIComponent(url.pathname.slice(1));
  if (/(?:^|[^a-z])prod(?:uction)?(?:$|[^a-z])/i.test(url.hostname))
    throw new Error('Production database hosts are forbidden');
  if (
    !database ||
    database.includes('/') ||
    /(?:^|[^a-z])prod(?:uction)?(?:$|[^a-z])/i.test(database)
  )
    throw new Error('Missing or production database name');
  if (options.target === 'local') {
    if (
      !['development', 'test'].includes(env.NODE_ENV ?? '') ||
      Object.entries(env).some(
        ([key, value]) => key.startsWith('RAILWAY_') && value,
      ) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
      throw new Error(
        'Local target requires development/test mode, loopback PostgreSQL and no Railway context',
      );
  } else if (options.target === 'railway-staging') {
    const matches = (
      actual: string | undefined,
      expected: string | undefined,
    ) => Boolean(actual && expected && actual === expected);
    if (
      env.RAILWAY_ENVIRONMENT_NAME !== 'staging' ||
      !matches(env.RAILWAY_PROJECT_ID, env.DEMO_STAGING_PROJECT_ID) ||
      !matches(env.RAILWAY_ENVIRONMENT_ID, env.DEMO_STAGING_ENVIRONMENT_ID) ||
      !matches(options.railwayProjectId, env.DEMO_STAGING_PROJECT_ID) ||
      !matches(options.railwayEnvironmentId, env.DEMO_STAGING_ENVIRONMENT_ID) ||
      !matches(url.hostname, env.DEMO_STAGING_DATABASE_HOST) ||
      !matches(url.port || '5432', env.DEMO_STAGING_DATABASE_PORT) ||
      !matches(database, env.DEMO_STAGING_DATABASE_NAME) ||
      !/^[a-z0-9-]+\.(?:railway\.internal|proxy\.rlwy\.net)$/.test(url.hostname)
    )
      throw new Error(
        'Railway staging requires matching project, environment and database allowlists',
      );
  } else {
    throw new Error('Unsupported demo target');
  }
  return env.DATABASE_URL!;
}
