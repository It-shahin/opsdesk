/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test harness for transpiled modules. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');

class ApiServerError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function loadRoute({ session = { user: { sub: 'user' } }, apiServerFetch, production = false } = {}) {
  // Load from the App Router directory: a handler under src/lib is not an endpoint.
  const filename = path.join(__dirname, '..', 'src/app/api/active-organization/route.ts');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  const mocks = {
    'next/server': { NextResponse },
    '@/lib/auth0': { auth0: { getSession: async () => session } },
    '@/lib/api/server': { ApiServerError, apiServerFetch: apiServerFetch ?? (async () => { assert.fail('Unexpected membership lookup'); }) },
    '@/lib/organizations/constants': { ACTIVE_ORGANIZATION_COOKIE: 'opsdesk_active_organization' },
  };
  vm.runInNewContext(compiled, {
    module: loadedModule,
    exports: loadedModule.exports,
    require(name) {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
      return mocks[name];
    },
    process: { env: { NODE_ENV: production ? 'production' : 'development' } },
  }, { filename });
  return loadedModule.exports.POST;
}

function request(body) {
  return new Request('https://opsdesk.example.test/api/active-organization', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

test('unauthenticated requests cannot persist a workspace preference', async () => {
  const response = await loadRoute({ session: null })(request('{"organizationId":"workspace"}'));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('malformed JSON and missing workspace IDs are rejected before membership lookup', async () => {
  const POST = loadRoute();
  for (const body of ['{', '{}', 'null', '{"organizationId":42}', '{"organizationId":""}']) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('set-cookie'), null);
  }
});

test('inaccessible workspaces do not overwrite the preference cookie', async () => {
  for (const status of [403, 404]) {
    const POST = loadRoute({ apiServerFetch: async () => { throw new ApiServerError(status, 'Access denied'); } });
    const response = await POST(request('{"organizationId":"workspace"}'));
    assert.equal(response.status, status);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(await response.json(), { error: status === 404 ? 'Organization not found' : 'Access denied' });
  }
});

test('accessible workspaces save the preference after membership validation', async () => {
  for (const production of [false, true]) {
    let validated = false;
    const POST = loadRoute({
      production,
      apiServerFetch: async (apiPath) => {
        assert.equal(apiPath, '/v1/organizations/workspace');
        validated = true;
        return { id: 'workspace' };
      },
    });
    const response = await POST(request('{"organizationId":"workspace"}'));
    assert.equal(validated, true);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    const cookie = response.cookies.get('opsdesk_active_organization');
    assert.equal(cookie.value, 'workspace');
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'lax');
    assert.equal(cookie.secure, production);
    assert.equal(cookie.path, '/');
    assert.equal(cookie.maxAge, 60 * 60 * 24 * 365);
  }
});

test('membership lookup failures do not persist a preference', async () => {
  const error = new Error('API unavailable');
  const POST = loadRoute({ apiServerFetch: async () => { throw error; } });
  await assert.rejects(POST(request('{"organizationId":"workspace"}')), (actual) => actual === error);
});
