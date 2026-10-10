/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness for the real TypeScript provider. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function mountProvider() {
  const handlers = new Map();
  const effects = [];
  const notices = [];
  const pendingAcks = new Map();
  const filtersSeen = [];
  let contextValue;
  const cache = { status: 'OPEN' };
  let serverStatus = 'OPEN';
  let refreshes = 0;
  const queryClient = {
    invalidateQueries: (filters) => {
      filtersSeen.push(filters);
      if (filters.predicate?.({ queryKey: ['ticket', 'demo-org', 'demo-ticket'] })) {
        refreshes++;
        cache.status = serverStatus;
      }
      return Promise.resolve();
    },
  };
  const socket = {
    connected: false,
    on: (event, handler) => handlers.set(event, handler),
    emit: (event, _payload, ack) => pendingAcks.set(event, ack),
    connect() {},
    removeAllListeners() {},
    disconnect() {},
  };
  const modules = {
    react: {
      createContext: () => ({ Provider: {} }),
      useCallback: (callback) => callback,
      useContext: () => null,
      useEffect: (effect) => effects.push(effect),
      useMemo: (create) => create(),
      useRef: (value) => ({ current: value }),
      useState: (value) => [value, () => {}],
    },
    'react/jsx-runtime': { jsx: (_type, props) => { contextValue = props.value; return null; } },
    '@tanstack/react-query': { useQueryClient: () => queryClient },
    'socket.io-client': { io: () => socket },
    sonner: { toast: { success: (message, options) => notices.push({ message, options }) } },
  };
  const loadedModule = { exports: {} };
  const filename = path.resolve(__dirname, '../src/components/realtime/realtime-provider.tsx');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports,
    require: (name) => {
      assert.ok(modules[name], `Unexpected dependency: ${name}`);
      return modules[name];
    },
    process: { env: { NEXT_PUBLIC_REALTIME_URL: 'https://realtime.example.test' } },
    window: { setTimeout, clearTimeout },
  }, { filename });
  loadedModule.exports.RealtimeProvider({ children: null });
  effects.forEach((effect) => effect());
  return {
    emit: (event) => {
      socket.connected = event === 'realtime.ready';
      handlers.get(event)();
    },
    acknowledge: (event, result = { ok: true }) => {
      assert.ok(pendingAcks.has(event), `Expected pending ${event}`);
      pendingAcks.get(event)(result);
      pendingAcks.delete(event);
    },
    joinOrganization: () => contextValue.joinOrganization('demo-org'),
    joinTicket: () => contextValue.joinTicket('demo-org', 'demo-ticket'),
    setServerStatus: (status) => { serverStatus = status; },
    cache, notices, filtersSeen,
    refreshes: () => refreshes,
  };
}

test('initial readiness and organization join do not redundantly refetch or announce recovery', async () => {
  const app = mountProvider();
  app.emit('realtime.ready');
  const join = app.joinOrganization();
  app.acknowledge('organization.join');
  await join;
  assert.equal(app.refreshes(), 0);
  assert.equal(app.notices.length, 0);
});

test('recovery waits for room acknowledgment before refetching missed and gap writes', async () => {
  const app = mountProvider();
  app.emit('realtime.ready');
  app.emit('disconnect');
  app.setServerStatus('CLOSED'); // Mutation arrived while this browser was offline.
  assert.equal(app.cache.status, 'OPEN');
  app.emit('realtime.ready');
  assert.equal(app.refreshes(), 0);
  assert.equal(app.cache.status, 'OPEN');
  const join = app.joinOrganization();
  app.setServerStatus('PENDING'); // A second write commits during the room rejoin gap.
  app.acknowledge('organization.join');
  await join;
  assert.equal(app.cache.status, 'PENDING');
  assert.equal(app.refreshes(), 1);
  app.emit('disconnect');
  app.emit('realtime.ready');
  assert.equal(app.refreshes(), 1);
  const rejoin = app.joinOrganization();
  app.acknowledge('organization.join');
  await rejoin;
  assert.equal(app.refreshes(), 2);
  assert.equal(new Set(app.notices.map((notice) => notice.options.id)).size, 1);
  assert.equal(app.notices[0].message, 'Realtime connection restored');
});

test('ticket recovery reconciles delivery queries only after a successful ticket-room join', async () => {
  const app = mountProvider();
  app.emit('realtime.ready');
  app.emit('disconnect');
  app.emit('realtime.ready');
  const organization = app.joinOrganization();
  app.acknowledge('organization.join');
  await organization;
  const ticket = app.joinTicket();
  await Promise.resolve(); // joinTicket first awaits the existing organization membership.
  assert.equal(app.filtersSeen.length, 1);
  app.acknowledge('ticket.join');
  await ticket;
  assert.equal(JSON.stringify(app.filtersSeen[1]), JSON.stringify({
    queryKey: ['ticket-messages', 'demo-org', 'demo-ticket'],
  }));
});

test('a denied organization rejoin does not reconcile unauthorized data', async () => {
  const app = mountProvider();
  app.emit('realtime.ready');
  app.emit('disconnect');
  app.emit('realtime.ready');
  const join = app.joinOrganization();
  app.acknowledge('organization.join', { ok: false, error: { message: 'Not found' } });
  await assert.rejects(join, /Not found/);
  assert.equal(app.refreshes(), 0);
});

test('organization recovery refreshes only realtime data in the acknowledged workspace', async () => {
  const app = mountProvider();
  app.emit('realtime.ready');
  app.emit('disconnect');
  app.emit('realtime.ready');
  const join = app.joinOrganization();
  app.acknowledge('organization.join');
  await join;
  const { predicate } = app.filtersSeen[0];
  for (const name of ['tickets', 'ticket', 'customer-tickets', 'analytics']) {
    assert.equal(predicate({ queryKey: [name, 'demo-org', 'resource'] }), true);
    assert.equal(predicate({ queryKey: [name, 'other-org', 'resource'] }), false);
  }
  for (const name of ['customers', 'members', 'invitations', 'ticket-members', 'ticket-tags', 'ticket-messages']) {
    assert.equal(predicate({ queryKey: [name, 'demo-org', 'resource'] }), false);
  }
  assert.equal(predicate({ queryKey: ['organizations'] }), false);
});

test('denied ticket recovery does not refresh messages after the permitted organization snapshot', async () => {
  const app = mountProvider();
  app.emit('realtime.ready');
  app.emit('disconnect');
  app.emit('realtime.ready');
  const organization = app.joinOrganization();
  app.acknowledge('organization.join');
  await organization;
  assert.equal(app.refreshes(), 1);
  const ticket = app.joinTicket();
  await Promise.resolve();
  app.acknowledge('ticket.join', { ok: false, error: { message: 'Not found' } });
  await assert.rejects(ticket, /Not found/);
  assert.equal(app.filtersSeen.length, 1);
  assert.equal(app.filtersSeen[0].predicate({ queryKey: ['ticket-messages', 'demo-org', 'demo-ticket'] }), false);
});
