const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sourcePicker', {
  list: () => ipcRenderer.invoke('sources:list'),
  choose: id => ipcRenderer.invoke('sources:choose', id),
  cancel: () => ipcRenderer.invoke('sources:cancel')
});
