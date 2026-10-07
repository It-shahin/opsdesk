/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test harness for transpiled modules. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');

class AccessTokenError extends Error {}
class Redirect extends Error {}

// Load the real TypeScript functions with isolated authentication/network mocks.
function loadModule(file, mocks, fetch) {
  const filename = path.join(__dirname, '..', 'src', file);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: loadedModule,
    exports: loadedModule.exports,
    require(name) {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
      return mocks[name];
    },
    process: { env: { API_SERVER_URL: 'https://api.example.test', AUTH0_AUDIENCE: 'https://api.example.test' } },
    Headers,
    URL,
    fetch,
  }, { filename });
  return loadedModule.exports;
}

function loadServer(auth0, fetch) {
  return loadModule('lib/api/server.ts', {
    'server-only': {},
    '@auth0/nextjs-auth0/errors': { AccessTokenError },
    '@/lib/auth0': { auth0 },
    react: { cache: (fn) => fn },
    'next/navigation': { redirect: (url) => { throw new Redirect(url); } },
  }, fetch);
}

function loadProxy(auth0) {
  return loadModule('proxy.ts', {
    '@auth0/nextjs-auth0/errors': { AccessTokenError },
    'next/server': { NextRequest, NextResponse },
    './lib/auth0': { auth0 },
  }).proxy;
}

test('requests refresh tokens and renews 60 seconds before expiry', () => {
  const { auth0 } = loadModule('lib/auth0.ts', {
    '@auth0/nextjs-auth0/server': { Auth0Client: class { constructor(options) { this.options = options; } } },
  });
  assert.equal(auth0.options.tokenRefreshBuffer, 60);
  assert.match(auth0.options.authorizationParameters.scope, /\boffline_access\b/);
});

test('protected pages renew using the response returned by Auth0', async () => {
  const request = new NextRequest('https://opsdesk.example.test/app/workspace?view=open');
  const response = NextResponse.next();
  const proxy = loadProxy({
    middleware: async (req) => { assert.equal(req, request); return response; },
    getAccessToken: async (req, res) => {
      assert.equal(req, request);
      assert.equal(res, response);
      res.cookies.set('__session', 'renewed-session', { httpOnly: true });
    },
  });
  assert.equal(await proxy(request), response);
  assert.equal(response.cookies.get('__session').value, 'renewed-session');
});

test('expired sessions return to sign-in with their original destination', async () => {
  const proxy = loadProxy({
    middleware: async () => NextResponse.next(),
    getAccessToken: async () => { throw new AccessTokenError('Refresh token unavailable'); },
  });
  const response = await proxy(new NextRequest('https://opsdesk.example.test/app/workspace?view=open'));
  assert.equal(response.status, 307);
  const destination = new URL(response.headers.get('location'));
  assert.equal(destination.pathname, '/auth/login');
  assert.equal(destination.searchParams.get('returnTo'), '/app/workspace?view=open');
});

test('public, Auth0, and API routes do not attempt page token renewal', async () => {
  const proxy = loadProxy({
    middleware: async () => NextResponse.next(),
    getAccessToken: async () => { assert.fail('Unexpected token renewal'); },
  });
  for (const pathname of ['/', '/auth/login', '/auth/callback', '/api/me', '/application']) {
    assert.equal((await proxy(new NextRequest(`https://opsdesk.example.test${pathname}`))).status, 200);
  }
});

test('proxy preserves unrelated errors', async () => {
  const error = new Error('Unexpected failure');
  const proxy = loadProxy({
    middleware: async () => NextResponse.next(),
    getAccessToken: async () => { throw error; },
  });
  await assert.rejects(proxy(new NextRequest('https://opsdesk.example.test/app')), (actual) => actual === error);
});

test('API 401 redirects instead of raising ApiServerError', async () => {
  const { apiServerFetch } = loadServer({ getAccessToken: async () => ({ token: 'token' }) },
    async () => new Response(JSON.stringify({ message: 'Invalid access token' }), { status: 401 }));
  await assert.rejects(apiServerFetch('/me'), (error) => error instanceof Redirect && error.message === '/auth/login?returnTo=/app');
});

test('missing or expired tokens redirect before making an API request', async () => {
  const { apiServerFetch } = loadServer({ getAccessToken: async () => { throw new AccessTokenError('Expired'); } },
    async () => { assert.fail('Unexpected API request'); });
  await assert.rejects(apiServerFetch('/me'), Redirect);
});

test('token lookup preserves unrelated errors', async () => {
  const error = new Error('Unexpected failure');
  const { apiServerFetch } = loadServer({ getAccessToken: async () => { throw error; } },
    async () => { assert.fail('Unexpected API request'); });
  await assert.rejects(apiServerFetch('/me'), (actual) => actual === error);
});

test('permission failures remain API errors without restarting login', async () => {
  const { apiServerFetch, ApiServerError } = loadServer({ getAccessToken: async () => ({ token: 'token' }) },
    async () => new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }));
  await assert.rejects(apiServerFetch('/me'), (error) => error instanceof ApiServerError && error.status === 403 && error.message === 'Forbidden');
});

test('successful requests retain authorization, options, and response handling', async () => {
  const { apiServerFetch } = loadServer({ getAccessToken: async () => ({ token: 'fresh-token' }) },
    async (url, init) => {
      assert.equal(url, 'https://api.example.test/tickets');
      assert.equal(init.headers.get('Authorization'), 'Bearer fresh-token');
      assert.equal(init.headers.get('Content-Type'), 'application/json');
      assert.equal(init.headers.get('X-Test'), 'preserved');
      assert.equal(init.method, 'POST');
      assert.equal(init.cache, 'no-store');
      return new Response(JSON.stringify({ id: 'ticket' }));
    });
  assert.equal((await apiServerFetch('/tickets', { method: 'POST', body: '{}', headers: { 'X-Test': 'preserved' } })).id, 'ticket');
});

test('no-content responses still return undefined', async () => {
  const { apiServerFetch } = loadServer({ getAccessToken: async () => ({ token: 'token' }) },
    async () => new Response(null, { status: 204 }));
  assert.equal(await apiServerFetch('/tickets'), undefined);
});
