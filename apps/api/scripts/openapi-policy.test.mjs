import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertLocalDocsEnvironment } from './openapi-policy.mjs';

test('UI refuses production, test, missing mode, Railway and hosted environment markers', () => {
  for (const env of [
    {},
    { NODE_ENV: 'production' },
    { NODE_ENV: 'test' },
    { NODE_ENV: 'development', RAILWAY_ENVIRONMENT_NAME: 'staging' },
    { NODE_ENV: 'development', RAILWAY_PROJECT_ID: 'project' },
    { NODE_ENV: 'development', APP_ENV: 'staging' },
    { NODE_ENV: 'development', DEPLOYMENT_ENV: 'production' },
  ])
    assert.throws(() => assertLocalDocsEnvironment(env));
  assert.doesNotThrow(() =>
    assertLocalDocsEnvironment({ NODE_ENV: 'development' }),
  );
});
test('UI refuses hosted platforms even when NODE_ENV is development', () => {
  for (const [key, value] of [
    ['VERCEL', '1'],
    ['VERCEL_ENV', 'development'],
    ['NETLIFY', 'true'],
    ['RENDER', 'true'],
    ['RENDER_SERVICE_ID', 'service'],
    ['FLY_APP_NAME', 'app'],
    ['DYNO', 'web.1'],
    ['AWS_LAMBDA_FUNCTION_NAME', 'function'],
    ['WEBSITE_INSTANCE_ID', 'instance'],
    ['K_SERVICE', 'service'],
    ['CF_PAGES', '1'],
  ]) {
    assert.throws(
      () => assertLocalDocsEnvironment({ NODE_ENV: 'development', [key]: value }),
      /no hosted-platform context/,
      key,
    );
  }
});
test('runtime entrypoints never import documentation or install Swagger routes', async () => {
  for (const entry of ['main', 'worker', 'app.module', 'worker.module']) {
    const source = await readFile(
      new URL(`../src/${entry}.ts`, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(source, /SwaggerModule|openapi\//);
  }
});
