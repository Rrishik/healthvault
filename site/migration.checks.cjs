const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

test('retire the legacy worker and navigate its clients without touching stored data', async () => {
  const handlers = new Map();
  const calls = [];
  const scope = 'https://healthvault.online/';
  const sandbox = vm.createContext({
    self: {
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => calls.push('skipWaiting'),
      registration: {
        scope,
        unregister: async () => calls.push('unregister'),
      },
      clients: {
        matchAll: async (options) => {
          assert.equal(options.type, 'window');
          return [
            { navigate: async (url) => calls.push(url) },
            {
              navigate: async () => {
                throw new Error('Tab closed');
              },
            },
          ];
        },
      },
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8'),
    sandbox,
  );
  let pending;
  const event = {
    waitUntil: (promise) => {
      pending = promise;
    },
  };
  handlers.get('install')(event);
  await pending;
  handlers.get('activate')(event);
  await pending;
  assert.deepEqual(calls, ['skipWaiting', 'unregister', scope]);
  assert.equal(handlers.has('fetch'), false);
});
