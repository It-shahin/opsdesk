/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness for real TypeScript modules. */
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');

const appOrigin = 'https://opsdesk.example.test';
const defaultEnv = {
  APP_BASE_URL: appOrigin,
  API_SERVER_URL: 'https://api.example.test',
};

function load(file, mocks = {}, fetch, env = defaultEnv) {
  const filename = path.join(__dirname, '..', file);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      module: loaded,
      exports: loaded.exports,
      require(name) {
        if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
        return mocks[name];
      },
      process: { env },
      Headers,
      URL,
      fetch,
    },
    { filename },
  );
  return loaded.exports;
}

function proxy({
  auth0 = {
    getSession: async () => ({ user: { sub: 'test-user' } }),
    getAccessToken: async () => ({ token: 'access-token' }),
  },
  fetch = async () => new Response('{}'),
  env = defaultEnv,
} = {}) {
  return load(
    'src/lib/api/proxy-request.ts',
    {
      'server-only': {},
      'next/server': { NextResponse },
      '@/lib/auth0': { auth0 },
    },
    fetch,
    env,
  );
}

function request(method, origin = appOrigin, body) {
  return new Request(`${appOrigin}/api/test?range=7d&cursor=a%2Fb`, {
    method,
    headers: {
      ...(origin === undefined ? {} : { origin }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body,
  });
}

for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
  test(`${method} rejects foreign, opaque and missing origins before auth or upstream calls`, async () => {
    const helper = proxy({
      auth0: {
        getSession: async () => assert.fail('Unexpected authentication'),
      },
      fetch: async () => assert.fail('Unexpected upstream request'),
    });
    for (const origin of [
      'https://evil.example',
      `${appOrigin}.evil.example`,
      `${appOrigin}:444`,
      'null',
      '',
    ]) {
      const response = await helper.proxyAuthenticatedRequest(
        request(method, origin),
        '/v1/tickets',
      );
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('cache-control'), 'no-store, private');
    }
    const missing = new Request(`${appOrigin}/api/test`, { method });
    assert.equal(
      (await helper.proxyAuthenticatedRequest(missing, '/v1/tickets')).status,
      403,
    );
  });
}

test('mutation origins use configured APP_BASE_URL, ignoring spoofed request and forwarded hosts', async () => {
  const helper = proxy();
  const req = new Request('https://evil.example/api/test', {
    method: 'POST',
    headers: {
      origin: 'https://evil.example',
      'x-forwarded-host': 'evil.example',
    },
  });
  assert.equal(
    (await helper.proxyAuthenticatedRequest(req, '/v1/tickets')).status,
    403,
  );
});

test('missing or malformed APP_BASE_URL fails closed', async () => {
  for (const value of [undefined, 'invalid-url']) {
    const helper = proxy({
      env: { ...defaultEnv, APP_BASE_URL: value },
      fetch: async () => assert.fail('Unexpected upstream request'),
    });
    assert.equal(
      (await helper.proxyAuthenticatedRequest(request('POST'), '/v1/tickets'))
        .status,
      500,
    );
  }
});

test('safe methods work without Origin or APP_BASE_URL', async () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    const helper = proxy({
      env: { API_SERVER_URL: defaultEnv.API_SERVER_URL },
      fetch: async () => new Response(null, { status: 204 }),
    });
    const response = await helper.proxyAuthenticatedRequest(
      new Request(`${appOrigin}/api/test`, { method }),
      '/v1/tickets',
    );
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
  }
});

test('same-origin mutations preserve raw body, query and bearer auth without forwarding browser cookies', async () => {
  const raw = '{ "body": "Hello", "kind": "PUBLIC_REPLY" }';
  const helper = proxy({
    env: { ...defaultEnv, APP_BASE_URL: `${appOrigin}/` },
    fetch: async (url, init) => {
      assert.equal(
        url,
        'https://api.example.test/v1/tickets?range=7d&cursor=a%2Fb',
      );
      assert.equal(init.method, 'POST');
      assert.equal(init.body, raw);
      assert.equal(init.cache, 'no-store');
      assert.equal(init.headers.get('authorization'), 'Bearer access-token');
      assert.equal(init.headers.get('content-type'), 'application/json');
      assert.equal(init.headers.get('cookie'), null);
      return new Response('{"id":"ticket"}', { status: 201 });
    },
  });
  const req = request('POST', appOrigin, raw);
  req.headers.set('cookie', 'session=browser-cookie');
  assert.equal(
    (await helper.proxyAuthenticatedRequest(req, '/v1/tickets')).status,
    201,
  );
});

test('upstream 429 preserves rate information and replaces public caching headers', async () => {
  const helper = proxy({
    fetch: async () =>
      new Response('{"message":"ThrottlerException"}', {
        status: 429,
        headers: {
          'content-type': 'application/problem+json',
          'cache-control': 'public, max-age=3600',
          pragma: 'cache',
          'retry-after': '60',
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '60',
          'set-cookie': 'upstream=secret',
          'x-internal': 'private',
        },
      }),
  });
  const response = await helper.proxyAuthenticatedRequest(
    request('GET'),
    '/v1/tickets',
  );
  assert.equal(response.status, 429);
  assert.equal(
    response.headers.get('content-type'),
    'application/problem+json',
  );
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  for (const [name, value] of [
    ['retry-after', '60'],
    ['x-ratelimit-limit', '30'],
    ['x-ratelimit-remaining', '0'],
    ['x-ratelimit-reset', '60'],
  ]) {
    assert.equal(response.headers.get(name), value);
  }
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('x-internal'), null);
  assert.deepEqual(await response.json(), { message: 'ThrottlerException' });
});

test('authentication and configuration error responses are private', async () => {
  for (const [options, status] of [
    [{ auth0: { getSession: async () => null } }, 401],
    [{ env: { APP_BASE_URL: appOrigin } }, 500],
  ]) {
    const helper = proxy({
      ...options,
      fetch: async () => assert.fail('Unexpected upstream request'),
    });
    const response = await helper.proxyAuthenticatedRequest(
      request('GET'),
      '/v1/tickets',
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
  }
});

const routes = {
  organizations: ['GET', 'POST'],
  'organizations/[organizationId]': ['GET'],
  'organizations/[organizationId]/customers': ['GET', 'POST'],
  'organizations/[organizationId]/customers/[customerId]': ['GET', 'PATCH'],
  'organizations/[organizationId]/customers/[customerId]/archive': ['POST'],
  'organizations/[organizationId]/customers/[customerId]/restore': ['POST'],
  'organizations/[organizationId]/tickets': ['GET', 'POST'],
  'organizations/[organizationId]/tickets/[ticketId]': ['GET', 'PATCH'],
  'organizations/[organizationId]/tickets/[ticketId]/assignee': ['PATCH'],
  'organizations/[organizationId]/tickets/[ticketId]/status': ['PATCH'],
  'organizations/[organizationId]/tickets/[ticketId]/messages': ['GET', 'POST'],
  'organizations/[organizationId]/tickets/[ticketId]/tags/[tagId]': [
    'POST',
    'DELETE',
  ],
  'organizations/[organizationId]/tickets/[ticketId]/attachments/init': [
    'POST',
  ],
  'organizations/[organizationId]/tickets/[ticketId]/attachments/[attachmentId]/complete':
    ['POST'],
  'organizations/[organizationId]/tickets/[ticketId]/attachments/[attachmentId]/download':
    ['GET'],
  'organizations/[organizationId]/tags': ['GET', 'POST'],
  'organizations/[organizationId]/members': ['GET'],
  'organizations/[organizationId]/members/[membershipId]/role': ['PATCH'],
  'organizations/[organizationId]/invitations': ['GET', 'POST'],
  'organizations/[organizationId]/invitations/[invitationId]': ['DELETE'],
  'organizations/[organizationId]/analytics/overview': ['GET'],
  'invitations/accept': ['POST'],
  me: ['GET'],
  'auth-test': ['GET'],
};

for (const [route, methods] of Object.entries(routes)) {
  test(`${route} preserves methods, encoded paths, and shared security`, async () => {
    const params = {
      organizationId: 'org/a',
      customerId: 'customer ?a',
      ticketId: 'ticket#1',
      membershipId: 'member/1',
      invitationId: 'invite/1',
      tagId: 'tag/1',
      attachmentId: 'file/1',
    };
    const apiPath =
      route === 'auth-test'
        ? '/auth/check'
        : '/v1/' +
          route.replace(/\[([^\]]+)\]/g, (_, name) =>
            encodeURIComponent(params[name]),
          );
    let calls = 0;
    const helper = proxy({
      fetch: async (url, init) => {
        calls++;
        assert.equal(
          url,
          `${defaultEnv.API_SERVER_URL}${apiPath}?range=7d&cursor=a%2Fb`,
        );
        assert.ok(methods.includes(init.method));
        return new Response('{}');
      },
    });
    const handler = load(`src/app/api/${route}/route.ts`, {
      '@/lib/api/proxy-request': helper,
    });
    assert.deepEqual(Object.keys(handler).sort(), [...methods].sort());
    for (const method of methods) {
      const response = await handler[method](request(method), {
        params: Promise.resolve(params),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store, private');
      if (method !== 'GET') {
        assert.equal(
          (
            await handler[method](request(method, 'https://evil.example'), {
              params: Promise.resolve(params),
            })
          ).status,
          403,
        );
      }
    }
    assert.equal(calls, methods.length);
  });
}

test('all Nest proxy handlers use the boundary; realtime token stays separate', () => {
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name === 'route.ts')
        assert.doesNotMatch(readFileSync(file, 'utf8'), /\bfetch\(/);
    }
  }
  walk(path.join(__dirname, '..', 'src/app/api'));
  const realtime = readFileSync(
    path.join(__dirname, '..', 'src/app/api/realtime/token/route.ts'),
    'utf8',
  );
  assert.match(realtime, /getAccessToken/);
  assert.doesNotMatch(realtime, /proxyAuthenticatedRequest/);
});

test('active organization rejects CSRF before reading the session or changing cookies', async () => {
  const handler = load('src/app/api/active-organization/route.ts', {
    'next/server': { NextResponse },
    '@/lib/auth0': {
      auth0: { getSession: async () => assert.fail('Unexpected session read') },
    },
    '@/lib/api/proxy-request': proxy(),
    '@/lib/api/server': {
      apiServerFetch: async () => assert.fail('Unexpected API call'),
    },
    '@/lib/organizations/constants': {
      ACTIVE_ORGANIZATION_COOKIE: 'active-org',
    },
  });
  const response = await handler.POST(
    request('POST', 'https://evil.example', '{"organizationId":"org"}'),
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('set-cookie'), null);
});

for (const NODE_ENV of ['development', 'production']) {
  test(`${NODE_ENV} browser policy allows realtime/R2 and sets expected security headers`, async () => {
    const config = load('next.config.ts', {}, undefined, {
      NODE_ENV,
      NEXT_PUBLIC_REALTIME_URL: 'https://realtime.example.test/socket',
      NEXT_PUBLIC_R2_ORIGIN: 'https://account.r2.cloudflarestorage.com/bucket',
    }).default;
    const rules = await config.headers();
    const headers = Object.fromEntries(
      rules
        .find((r) => r.source === '/:path*')
        .headers.map((h) => [h.key, h.value]),
    );
    const csp = headers['Content-Security-Policy'];
    assert.match(
      csp,
      /connect-src 'self' https:\/\/realtime.example.test wss:\/\/realtime.example.test https:\/\/account.r2.cloudflarestorage.com/,
    );
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(
      headers['Permissions-Policy'],
      'camera=(), microphone=(), geolocation=()',
    );
    assert.equal(
      headers['Cross-Origin-Opener-Policy'],
      'same-origin-allow-popups',
    );
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    if (NODE_ENV === 'production') {
      assert.equal(headers['Strict-Transport-Security'], 'max-age=31536000');
      assert.doesNotMatch(csp, /unsafe-eval| ws: | http:/);
      assert.match(csp, /upgrade-insecure-requests/);
    } else {
      assert.equal(headers['Strict-Transport-Security'], undefined);
      assert.match(csp, /unsafe-eval/);
      assert.match(csp, / ws: http:/);
      assert.doesNotMatch(csp, /upgrade-insecure-requests/);
    }
    const apiHeaders = Object.fromEntries(
      rules
        .find((r) => r.source === '/api/:path*')
        .headers.map((h) => [h.key, h.value]),
    );
    assert.equal(apiHeaders['Cache-Control'], 'no-store, private');
    assert.equal(apiHeaders.Pragma, 'no-cache');
  });
}

test('development browser policy works before optional public URLs are configured', async () => {
  const config = load('next.config.ts', {}, undefined, {
    NODE_ENV: 'development',
  }).default;
  const csp = (await config.headers())[0].headers.find(
    (h) => h.key === 'Content-Security-Policy',
  ).value;
  assert.match(csp, /http:\/\/localhost:3001 ws:\/\/localhost:3001/);
  assert.doesNotMatch(csp, /undefined/);
});
