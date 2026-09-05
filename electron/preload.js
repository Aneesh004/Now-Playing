const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startAuthServer: () => ipcRenderer.invoke('spotify:start-auth-server'),
  openExternal: (url) => ipcRenderer.invoke('spotify:open-external', url),
  onAuthCode: (callback) => {
    ipcRenderer.on('spotify:auth-code', (_event, code) => callback(code));
  },
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  toggleCompact: () => ipcRenderer.send('window:toggle-compact'),
  setCompact: (compact) => ipcRenderer.send('window:set-compact', compact),
  getStoredTokens: () => ipcRenderer.invoke('auth:get-tokens'),
  saveStoredTokens: (tokens) => ipcRenderer.invoke('auth:save-tokens', tokens),
  clearStoredTokens: () => ipcRenderer.invoke('auth:clear-tokens'),
});
