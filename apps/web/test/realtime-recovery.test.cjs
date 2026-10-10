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
  const cache = { status: 'OPEN' };
  let serverStatus = 'OPEN';
  let refreshes = 0;
  const queryClient = {
    invalidateQueries: (filters) => {
      if (filters === undefined) {
        refreshes++;
        cache.status = serverStatus;
      }
      return Promise.resolve();
    },
  };
  const socket = {
    on: (event, handler) => handlers.set(event, handler),
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
    'react/jsx-runtime': { jsx: () => null },
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
  }, { filename });
  loadedModule.exports.RealtimeProvider({ children: null });
  effects.forEach((effect) => effect());
  return {
    emit: (event) => handlers.get(event)(),
    setServerStatus: (status) => { serverStatus = status; },
    cache, notices,
    refreshes: () => refreshes,
  };
}

test('initial realtime readiness does not redundantly refetch or announce recovery', () => {
  const app = mountProvider();
  app.emit('realtime.ready');
  assert.equal(app.refreshes(), 0);
  assert.equal(app.notices.length, 0);
});

test('recovery refetches missed ticket changes and replaces repeated recovery notices', () => {
  const app = mountProvider();
  app.emit('realtime.ready');
  app.emit('disconnect');
  app.setServerStatus('CLOSED'); // Mutation arrived while this browser was offline.
  assert.equal(app.cache.status, 'OPEN');
  app.emit('realtime.ready');
  assert.equal(app.cache.status, 'CLOSED');
  assert.equal(app.refreshes(), 1);
  app.emit('disconnect');
  app.emit('realtime.ready');
  assert.equal(app.refreshes(), 2);
  assert.equal(new Set(app.notices.map((notice) => notice.options.id)).size, 1);
  assert.equal(app.notices[0].message, 'Realtime connection restored');
});
