const { app, BrowserWindow, session, dialog, systemPreferences, ipcMain } = require('electron');
const path = require('node:path');
const permissions = require('./permissions.cjs');
const { chooseSource } = require('./picker.cjs');
const ROOM_URL = 'https://aurora.ddtech.cloud/';
const trusted = (url) => { try { return new URL(url).origin === new URL(ROOM_URL).origin; } catch { return false; } };

async function createWindow() {
  const win = new BrowserWindow({
    width: 1360, height: 900, minWidth: 800, minHeight: 600,
    title: 'Aurora', backgroundColor: '#101015',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
  try { await win.loadURL(ROOM_URL); }
  catch { dialog.showMessageBox(win, { type: 'error', message: 'Não foi possível abrir a sala.', detail: 'Verifique sua conexão e abra o aplicativo novamente.' }); }
}

app.whenReady().then(() => {
  ipcMain.on('capture-failure', (event, code) => {
    if (!trusted(event.senderFrame?.url) || !/^[A-Za-z]{1,64}$/.test(code)) return;
    const status = process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'unknown';
    console.error('Capture failure', code, 'screen permission', status);
    dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: 'warning', message: 'O navegador não iniciou a captura de tela.',
      detail: `Código: ${code}. Permissão de tela: ${status}.\n` + (process.platform === 'darwin' ? 'Se você não cancelou a seleção, confira Aurora em Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela e Áudio do Sistema. Depois de autorizar, encerre o Aurora completamente e abra novamente.' : 'Se você não cancelou a seleção, confira as permissões de captura do sistema e tente novamente.')
    });
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => permissions.check(permission, origin));
  session.defaultSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    const origin = details.securityOrigin || details.requestingUrl || contents.getURL();
    if (permissions.request(permission, origin, details)) return callback(true);
    if (!permissions.request(permission, origin, details, true)) return callback(false);
    try {
      const devices = details.mediaTypes.map(type => type === 'audio' ? 'microfone' : 'câmera');
      const parent = BrowserWindow.fromWebContents(contents);
      const { response } = await dialog.showMessageBox(parent, { type: 'question', message: `Permitir ${devices.join(' e ')} nesta sala?`, detail: 'O dispositivo será usado para transmitir aos participantes da sala atual. Você pode desligá-lo no rodapé.', buttons: ['Não permitir', 'Permitir'], defaultId: 0, cancelId: 0 });
      if (response !== 1 || contents.isDestroyed() || !trusted(contents.getURL())) return callback(false);
      if (process.platform === 'darwin') for (const type of details.mediaTypes) {
        if (!await systemPreferences.askForMediaAccess(type === 'audio' ? 'microphone' : 'camera')) return callback(false);
      }
      callback(!contents.isDestroyed() && trusted(contents.getURL()));
    } catch { callback(false); }
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!trusted(request.securityOrigin)) return callback({});
    try {
      const source = await chooseSource(BrowserWindow.getFocusedWindow());
      callback(source ? { video: source } : {});
    } catch (error) {
      callback({});
      const status = process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'unknown';
      console.error('Screen capture failed:', error.message, 'permission:', status);
      dialog.showMessageBox({ type: 'error', message: 'Não foi possível iniciar o compartilhamento.', detail: process.platform === 'darwin' ? `Permissão de tela: ${status}. Abra Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela e Áudio do Sistema. Autorize Aurora (ou Electron no modo de desenvolvimento) e reinicie o app.\n${error.message}` : error.message });
    }
  }, { useSystemPicker: false });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
