const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('capture forwards video, disables unsupported audio, and reports original failure', async () => {
  const listeners = new Map(), messages = [], calls = [];
  const failure = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  let fail = false;
  const stream = {};
  const context = vm.createContext({
    location: { origin: 'https://aurora.ddtech.cloud' },
    navigator: { mediaDevices: { getDisplayMedia: async (options) => { calls.push(options); if (fail) throw failure; return stream; } } },
    window: { addEventListener: (type, fn) => listeners.set(type, fn), dispatchEvent: event => listeners.get(event.type)?.(event) },
    CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data.detail; } },
    require: () => ({ contextBridge: { executeInMainWorld: ({ func }) => func() }, ipcRenderer: { send: (...args) => messages.push(args) } })
  });
  vm.runInContext(fs.readFileSync(__dirname + '/preload.cjs', 'utf8'), context);
  const capture = context.navigator.mediaDevices.getDisplayMedia;
  assert.equal(await capture({ video: true, audio: true }), stream);
  assert.equal(calls[0].audio, false);
  assert.equal(calls[0].video, true);
  fail = true;
  await assert.rejects(capture(), error => error === failure);
  assert.deepEqual(messages, [['capture-failure', 'NotAllowedError']]);
});
