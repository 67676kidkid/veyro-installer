// Veyro — preload bridge.
// Secure, minimal IPC surface (contextIsolation: true).
// The renderer can only call the fixed methods below; no raw
// shell/WMI access is ever exposed to page scripts.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('veyroAgent', {
  connected: true,
  version: 1,
  scan: () => ipcRenderer.invoke('veyro:scan'),
  metrics: () => ipcRenderer.invoke('veyro:metrics'),
  applyOptimization: (id, on) => ipcRenderer.invoke('veyro:applyopt', id, on),
  openExternal: (url) => ipcRenderer.invoke('veyro:open', url),
  license: () => ipcRenderer.invoke('veyro:license'),
  activateLicense: (key, grantedAt, expiresAt) => ipcRenderer.invoke('veyro:activate', key, grantedAt, expiresAt),
  removeLicense: () => ipcRenderer.invoke('veyro:remove'),
  prefs: () => ipcRenderer.invoke('veyro:prefs'),
  savePrefs: (data) => ipcRenderer.invoke('veyro:saveprefs', data),
  createRestorePoint: () => ipcRenderer.invoke('veyro:restorepoint'),
  tool: (name, arg) => ipcRenderer.invoke('veyro:tool', name, arg),
  onNav: (cb) => ipcRenderer.on('veyro:nav', (e, page) => { try { cb(page); } catch (err) { /* ignore */ } }),
  checkUpdate: () => ipcRenderer.invoke('veyro:check-update'),
  downloadUpdate: () => ipcRenderer.invoke('veyro:download-update'),
  installUpdate: () => ipcRenderer.invoke('veyro:install-update'),
});