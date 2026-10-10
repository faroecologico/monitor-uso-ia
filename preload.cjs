const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flotante', {
  alto: (px) => ipcRenderer.send('alto', px),
});
