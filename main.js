// Veyro — Electron main process.
// Loads the renderer (app/index.html) in a desktop window and
// hosts the native Windows hardware agent (native/agent.js).
const { app, BrowserWindow, ipcMain, shell, protocol, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const agent = require('./native/agent');
const { autoUpdater } = require('electron-updater');

/* keep the legacy data folder name (VEYRO) so accounts, licenses and
   settings survive the Veyro rebrand — changing productName alone would
   reset the userData path and orphan all stored state */
try { app.setPath('userData', path.join(app.getPath('appData'), 'VEYRO')); } catch (e) {}

/* veyro:// custom scheme — serves the Market Finder (VeyronFinderAi)
   website from app/finder/ so the site is embedded in the app,
   and registers the scheme for deep links (veyro://finder). */
protocol.registerSchemesAsPrivileged([
  { scheme: 'veyro', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

const FINDER_DIR = path.join(__dirname, 'app', 'finder');
const FINDER_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

const NAV_PAGES = ['dashboard', 'optimize', 'optcenter', 'performance', 'hardware', 'upgrades', 'games', 'health', 'tips', 'settings', 'driver', 'report', 'finder'];

function veyroPageFromArgv(argv) {
  const arg = (argv || []).find(a => typeof a === 'string' && a.startsWith('veyro://'));
  if (!arg) return null;
  const host = arg.replace('veyro://', '').split('/')[0].split('?')[0].toLowerCase();
  return NAV_PAGES.includes(host) ? host : null;
}

/* single instance — deep links land in the running app.
   VEYRO_ALLOW_MULTI=1 bypasses the lock (used by tooling/tests). */
const gotLock = process.env.VEYRO_ALLOW_MULTI === '1' ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else if (process.env.VEYRO_ALLOW_MULTI === '1') {
  /* multi-instance mode: no second-instance routing */
} else {
  app.on('second-instance', (e, argv) => {
    const page = veyroPageFromArgv(argv);
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      if (page) win.webContents.send('veyro:nav', page);
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#050805',
    show: false,
    autoHideMenuBar: true,
    title: 'Veyro — PC Performance',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => {
    console.log('Window ready-to-show');
    win.show();
  });

  /* deep link on first launch (veyro://finder via OS) */
  const launchPage = veyroPageFromArgv(process.argv);
  if (launchPage) {
    win.webContents.once('did-finish-load', () => win.webContents.send('veyro:nav', launchPage));
  }
  return win;
}

/* auto-updater config */
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let updateCheckInterval = null;

function startAutoUpdateChecks() {
  // Check on startup
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  
  // Check every 4 hours
  updateCheckInterval = setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}

function stopAutoUpdateChecks() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

// Forward update events to renderer
autoUpdater.on('update-available', (info) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('veyro:update-available', { version: info.version, notes: info.releaseNotes });
});

autoUpdater.on('update-not-available', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('veyro:update-not-available');
});

autoUpdater.on('error', (err) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('veyro:update-error', { msg: String(err && err.message || err) });
});

autoUpdater.on('download-progress', (progress) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('veyro:update-progress', { percent: progress.percent, transferred: progress.transferred, total: progress.total });
});

autoUpdater.on('update-downloaded', (info) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('veyro:update-downloaded', { version: info.version, notes: info.releaseNotes });
});

/* manual check from renderer */
ipcMain.handle('veyro:check-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.updateInfo) {
      return { ok: true, hasUpdate: true, version: result.updateInfo.version, notes: result.updateInfo.releaseNotes };
    }
    return { ok: true, hasUpdate: false };
  } catch (err) {
    return { ok: false, msg: String(err && err.message || err) };
  }
});

ipcMain.handle('veyro:download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return { ok: false, msg: String(err && err.message || err) };
  }
});

ipcMain.handle('veyro:install-update', async () => {
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});

app.whenReady().then(() => {
  agent.registerIpc(ipcMain);
  agent.startLive();
  startAutoUpdateChecks();

  /* veyro:// protocol — serves app/finder/* (Market Finder site) */
  protocol.handle('veyro', (req) => {
    try {
      const u = new URL(req.url);
      if (u.hostname !== 'finder') return new Response('Not found', { status: 404 });
      const rel = u.pathname === '/' ? '/index.html' : u.pathname;
      const target = path.normalize(path.join(FINDER_DIR, decodeURIComponent(rel)));
      if (!target.startsWith(FINDER_DIR)) return new Response('Forbidden', { status: 403 });
      const body = fs.readFileSync(target);
      const ext = path.extname(target).toLowerCase();
      return new Response(body, { headers: { 'content-type': FINDER_MIME[ext] || 'application/octet-stream' } });
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  });

  /* deep links (veyro://finder etc.) */
  app.setAsDefaultProtocolClient('veyro');

  /* ---- embedded Veyro backend (accounts + license server) ---- */
  /* Runs a local API + web dashboard on http://127.0.0.1:9175.
     If an external server is already listening on the port, this silently
     falls back to it (dev mode) so the app keeps working either way. */
  try {
    const backend = require('./server/server');
    const backendPort = Number(process.env.VEYRO_PORT || 9175);
    const backendInstance = backend.createServer({
      dbFile: path.join(app.getPath('userData'), 'server-db.json'),
      siteDir: path.join(__dirname, 'server', 'public')
    });
    backendInstance.server.on('error', () => { /* port taken — external backend in use */ });
    backendInstance.server.listen(backendPort, '127.0.0.1');
  } catch (err) {
    /* backend is optional — the app still works fully offline */
  }

  ipcMain.handle('veyro:open', (e, url) => {
    try {
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        shell.openExternal(url);
        return { ok: true };
      }
    } catch (err) { /* fall through */ }
    return { ok: false };
  });

  /* ---- premium license ---- */
  ipcMain.handle('veyro:license', () => {
    try {
      const raw = fs.readFileSync(path.join(app.getPath('userData'), 'license.json'), 'utf8');
      const lic = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (lic && lic.key) {
        return { ok: true, key: lic.key, grantedAt: lic.grantedAt || null, expiresAt: lic.expiresAt || null };
      }
    } catch (err) { /* no license yet */ }
    return { ok: false };
  });

  /* ---- activate: renderer validates the key (format + checksum) ---- */
  ipcMain.handle('veyro:activate', (e, key, grantedAt, expiresAt) => {
    if (typeof key !== 'string' || typeof grantedAt !== 'number') {
      return { ok: false, msg: 'Invalid request.' };
    }
    try {
      const licFile = path.join(app.getPath('userData'), 'license.json');
      fs.mkdirSync(path.dirname(licFile), { recursive: true });
      fs.writeFileSync(licFile, JSON.stringify({
        key: key.trim().toUpperCase(),
        grantedAt,
        expiresAt: typeof expiresAt === 'number' ? expiresAt : null
      }));
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: 'Could not save license: ' + err.message };
    }
  });
/* ---- persisted applied-state registry (%APPDATA%\VEYRO\settings.json) ---- */
  ipcMain.handle('veyro:prefs', () => {
    try {
      const raw = fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8');
      const d = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        return { ok: true, data: d };
      }
    } catch (err) { /* no prefs file yet */ }
    return { ok: true, data: {} };
  });

  ipcMain.handle('veyro:saveprefs', (e, data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, msg: 'Invalid preferences payload.' };
    }
    try {
      const f = path.join(app.getPath('userData'), 'settings.json');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, JSON.stringify(data));
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: 'Could not save preferences: ' + err.message };
    }
  });

  /* ---- remove premium (delete license) ---- */
  ipcMain.handle('veyro:remove', () => {
    try {
      const f = path.join(app.getPath('userData'), 'license.json');
      if (fs.existsSync(f)) fs.unlinkSync(f);
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: 'Could not remove license: ' + err.message };
    }
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('before-quit', () => {
  agent.stopLive();
  stopAutoUpdateChecks();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});