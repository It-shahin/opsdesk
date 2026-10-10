const hostedMarkers = new Set([
  'VERCEL',
  'NETLIFY',
  'RENDER',
  'RENDER_SERVICE_ID',
  'FLY_APP_NAME',
  'DYNO',
  'AWS_LAMBDA_FUNCTION_NAME',
  'WEBSITE_INSTANCE_ID',
  'K_SERVICE',
  'CF_PAGES',
]);

export function assertLocalDocsEnvironment(env) {
  if (
    env.NODE_ENV !== 'development' ||
    Object.entries(env).some(
      ([key, value]) =>
        value &&
        (key.startsWith('RAILWAY_') ||
          key.startsWith('VERCEL_') ||
          hostedMarkers.has(key)),
    )
  ) {
    throw new Error(
      'Swagger UI is local development only: NODE_ENV=development and no hosted-platform context.',
    );
  }
  for (const key of ['APP_ENV', 'ENVIRONMENT', 'DEPLOYMENT_ENV']) {
    if (
      env[key] &&
      !['local', 'development', 'test'].includes(env[key].toLowerCase())
    )
      throw new Error('Refusing documentation UI in a hosted environment.');
  }
}
