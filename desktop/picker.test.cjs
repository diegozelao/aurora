const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
test('source chooser requires explicit valid selection and rejects remote renderer', async () => {
  const handlers = new Map(); let win;
  class Window extends EventEmitter {
    constructor() { super(); win = this; this.webContents = { id: 5, mainFrame: {}, setWindowOpenHandler() {}, on() {} }; }
    loadURL(url) { this.webContents.mainFrame.url = url; return Promise.resolve(); }
    isDestroyed() { return false; }
    close() { this.emit('closed'); }
  }
  const source = { id: 'window:42:0', name: 'Editor', thumbnail: { toDataURL: () => 'data:image/png;base64,AA==' } };
  const context = { __dirname, module: { exports: {} }, require: name => name === 'electron' ? { BrowserWindow: Window, ipcMain: { handle: (name, handler) => handlers.set(name, handler) }, desktopCapturer: { getSources: async () => [source] } } : require(name) };
  vm.runInNewContext(fs.readFileSync(__dirname + '/picker.cjs', 'utf8'), context);
  const result = context.module.exports.chooseSource();
  const event = { sender: win.webContents, senderFrame: win.webContents.mainFrame };
  await assert.rejects(handlers.get('sources:list')({ sender: { id: 99 } }), /Acesso/);
  const items = await handlers.get('sources:list')(event);
  assert.equal(items[0].kind, 'window');
  assert.throws(() => handlers.get('sources:choose')(event, 'invalid'), /disponível/);
  handlers.get('sources:choose')(event, source.id);
  assert.equal(await result, source);
});
