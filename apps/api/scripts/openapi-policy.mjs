export function assertLocalDocsEnvironment(env) {
  if (
    env.NODE_ENV !== 'development' ||
    Object.entries(env).some(
      ([key, value]) => key.startsWith('RAILWAY_') && value,
    )
  ) {
    throw new Error(
      'Swagger UI is local development only: NODE_ENV=development and no Railway context.',
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
