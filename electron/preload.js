const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  discover: () => ipcRenderer.invoke('discover'),
  ping: (url) => ipcRenderer.invoke('ping', url),
  pickFolder: (title) => ipcRenderer.invoke('pick-folder', title),
  openFile: (args) => ipcRenderer.invoke('file:open', args),
  revealFile: (relPath) => ipcRenderer.invoke('file:reveal', relPath),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  getAutostart: () => ipcRenderer.invoke('autostart:get'),
  setAutostart: (on) => ipcRenderer.invoke('autostart:set', on),
  onFileSynced: (fn) => {
    const h = (e, data) => fn(data);
    ipcRenderer.on('file-synced', h);
    return () => ipcRenderer.removeListener('file-synced', h);
  },
});
