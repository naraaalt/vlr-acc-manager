const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('valorant', {
  getCurrentStore: () => ipcRenderer.invoke('store:current'),
  getDashboard: () => ipcRenderer.invoke('accounts:dashboard'),
  captureCurrentAccount: (label) => ipcRenderer.invoke('accounts:capture-current', label),
  addManualAccount: (label) => ipcRenderer.invoke('accounts:add-manually', label),
  syncCurrentAccount: (label) => ipcRenderer.invoke('accounts:sync-current', label),
  refreshAccountMarket: (label) => ipcRenderer.invoke('accounts:refresh-market', label),
  deleteAccount: (label) => ipcRenderer.invoke('accounts:delete', label),
  switchAccount: (label) => ipcRenderer.invoke('accounts:switch', label),
  detectTcno: () => ipcRenderer.invoke('accounts:tcno-detect'),
  importTcno: (ids) => ipcRenderer.invoke('accounts:tcno-import', ids)
});
