const { BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const pickerURL = pathToFileURL(path.join(__dirname, 'picker.html')).href;
const sessions = new Map();
function sessionFor(event) {
  const state = sessions.get(event.sender.id);
  if (!state || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== pickerURL) throw new Error('Acesso negado');
  return state;
}
ipcMain.handle('sources:list', async (event) => {
  const state = sessionFor(event);
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 360, height: 220 }, fetchWindowIcons: true });
  state.sources = sources.filter(source => source.name !== 'Aurora — Escolher fonte');
  return state.sources.map(source => ({ id: source.id, name: source.name, kind: source.id.startsWith('screen:') ? 'screen' : 'window', preview: source.thumbnail.toDataURL() }));
});
ipcMain.handle('sources:choose', (event, id) => {
  const state = sessionFor(event);
  const source = state.sources.find(item => item.id === id);
  if (!source) throw new Error('Atualize a lista e selecione uma fonte disponível.');
  state.finish(source);
});
ipcMain.handle('sources:cancel', (event) => sessionFor(event).finish(null));

function chooseSource(parent) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({ parent: parent || undefined, modal: Boolean(parent), width: 900, height: 680, minWidth: 640, minHeight: 480, title: 'Aurora — Escolher fonte', backgroundColor: '#141319', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'picker-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    const id = win.webContents.id;
    let finished = false;
    const finish = (source) => { if (finished) return; finished = true; sessions.delete(id); resolve(source); if (!win.isDestroyed()) win.close(); };
    sessions.set(id, { sources: [], finish });
    win.on('closed', () => finish(null));
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.loadURL(pickerURL).catch(error => { if (finished) return; finished = true; sessions.delete(id); win.close(); reject(error); });
  });
}
module.exports = { chooseSource };
