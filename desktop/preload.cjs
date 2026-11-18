const { contextBridge, ipcRenderer } = require('electron');

// The hosted renderer receives no Node.js or unrestricted IPC capability.
if (location.origin === 'https://aurora.ddtech.cloud') {
  window.addEventListener('aurora-capture-failure', (event) => {
    const code = String(event.detail || 'UnknownError');
    if (/^[A-Za-z]{1,64}$/.test(code)) ipcRenderer.send('capture-failure', code);
  });
  contextBridge.executeInMainWorld({ func: () => {
    const media = navigator.mediaDevices;
    if (!media?.getDisplayMedia) return;
    const capture = media.getDisplayMedia.bind(media);
    media.getDisplayMedia = async (options = {}) => {
      try {
        // This desktop release supports screen video only.
        return await capture({ ...options, audio: false });
      } catch (error) {
        window.dispatchEvent(new CustomEvent('aurora-capture-failure', { detail: error.name || 'UnknownError' }));
        throw error;
      }
    };
  } });
}
