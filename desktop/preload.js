const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ecNet', { post: (url, headers, body) => ipcRenderer.invoke('ec-post', { url, headers, body }) });
