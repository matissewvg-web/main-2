const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, DEFAULT_PORT } = require('../server');
const { startResponder, discover, localAddresses } = require('./discovery');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const configFile = () => path.join(app.getPath('userData'), 'config.json');
const defaultDataDir = () => path.join(app.getPath('documents'), 'The Break 5 Data');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2));
}

let config = loadConfig();
let host = null; // running server when this PC is the host
let stopResponder = null;
let hostError = null;
let win = null;
let tray = null;
let quitting = false;

async function startHost() {
  try {
    const dataDir = config.dataDir || defaultDataDir();
    host = await startServer({ dataDir, port: config.port || DEFAULT_PORT, staticDir: path.join(__dirname, '..', 'dist') });
    stopResponder = startResponder(host.port);
  } catch (e) {
    hostError = e.code === 'EADDRINUSE'
      ? `Poort ${config.port || DEFAULT_PORT} is al in gebruik. Draait The Break 5 al op deze pc?`
      : e.message;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    title: 'The Break 5',
    backgroundColor: '#0f1117',
    icon: path.join(__dirname, '..', 'dist', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  Menu.setApplicationMenu(null);

  if (process.env.VITE_DEV_URL) win.loadURL(process.env.VITE_DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Links in notes open in the normal browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    // about:blank is the print view for meeting notes.
    if (url === 'about:blank' || url === '') return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    if (/^https?:|^mailto:|^tel:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:') && !url.startsWith(process.env.VITE_DEV_URL || '\0')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  // On the host, closing the window keeps the server running in the tray,
  // otherwise every colleague would lose access.
  win.on('close', (e) => {
    if (host && !quitting) {
      e.preventDefault();
      win.hide();
      if (!config.trayHintShown) {
        tray?.displayBalloon?.({ title: 'The Break 5 draait nog', content: 'Collega\'s kunnen blijven werken. Afsluiten via het icoon rechtsonder.' });
        config.trayHintShown = true;
        saveConfig(config);
      }
    }
  });

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key === 'I'))) {
      win.webContents.toggleDevTools();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'dist', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('The Break 5 (host)');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Openen', click: () => { win.show(); win.focus(); } },
    { type: 'separator' },
    { label: 'Afsluiten (collega\'s verliezen toegang)', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => { win.show(); win.focus(); });
}

// ---- Opening shared files -------------------------------------------------
// On the host the real file is opened. On other PCs the file is downloaded to a
// temp folder and opened; when the user saves it, the change is uploaded back.
const watched = new Map();
const tempRoot = () => path.join(os.tmpdir(), 'TheBreak5');

async function openRemoteFile({ base, token, relPath }) {
  const res = await fetch(`${base}/api/files/download?path=${encodeURIComponent(relPath)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Downloaden mislukt (${res.status})`);
  const dir = path.join(tempRoot(), Math.random().toString(36).slice(2, 10));
  fs.mkdirSync(dir, { recursive: true });
  const local = path.join(dir, path.basename(relPath));
  fs.writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  const err = await shell.openPath(local);
  if (err) throw new Error(err);

  let lastMtime = fs.statSync(local).mtimeMs;
  let timer = null;
  const onChange = (curr) => {
    if (!curr.mtimeMs || curr.mtimeMs === lastMtime) return;
    lastMtime = curr.mtimeMs;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const body = fs.readFileSync(local);
        const parent = relPath.split('/').slice(0, -1).join('/');
        const up = await fetch(
          `${base}/api/files/upload?path=${encodeURIComponent(parent)}&name=${encodeURIComponent(path.basename(relPath))}&overwrite=1`,
          { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body }
        );
        if (!up.ok) throw new Error(`status ${up.status}`);
        win?.webContents.send('file-synced', { path: relPath, ok: true });
      } catch (e) {
        win?.webContents.send('file-synced', { path: relPath, ok: false, error: e.message, local });
      }
    }, 1500);
  };
  fs.watchFile(local, { interval: 2000 }, onChange);
  watched.set(local, onChange);
  return { local };
}

// ---- IPC ---------------------------------------------------------------------
ipcMain.handle('config:get', () => ({
  ...config,
  hostRunning: !!host,
  hostError,
  hostPort: host?.port || null,
  addresses: localAddresses(),
  computerName: os.hostname(),
  defaultDataDir: defaultDataDir(),
  dataDir: config.dataDir || (config.mode === 'host' ? defaultDataDir() : undefined),
}));

ipcMain.handle('config:set', (e, patch) => {
  config = { ...config, ...patch };
  saveConfig(config);
  return config;
});

ipcMain.handle('app:relaunch', () => {
  quitting = true;
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('autostart:get', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('autostart:set', (e, on) => {
  app.setLoginItemSettings({ openAtLogin: !!on });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('discover', () => discover(2000));

ipcMain.handle('ping', async (e, url) => {
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/api/ping`, { signal: AbortSignal.timeout(3000) });
    const data = await r.json();
    return data.app === 'The Break 5';
  } catch {
    return false;
  }
});

ipcMain.handle('pick-folder', async (e, title) => {
  const r = await dialog.showOpenDialog(win, { title, properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('file:open', async (e, { base, token, relPath }) => {
  try {
    if (host) {
      const full = path.join(host.filesRoot, ...relPath.split('/'));
      const err = await shell.openPath(full);
      if (err) throw new Error(err);
      return { ok: true };
    }
    await openRemoteFile({ base, token, relPath });
    return { ok: true, synced: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('file:reveal', (e, relPath) => {
  if (!host) return false;
  const full = path.join(host.filesRoot, ...String(relPath || '').split('/').filter(Boolean));
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) shell.openPath(full);
  else shell.showItemInFolder(full);
  return true;
});

ipcMain.handle('open-path', (e, p) => (host ? shell.openPath(p) : null));

// ---- Lifecycle ---------------------------------------------------------------
app.on('second-instance', () => {
  if (win) {
    win.show();
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(async () => {
  if (config.mode === 'host') await startHost();
  createWindow();
  if (host) createTray();
});

app.on('before-quit', () => { quitting = true; });

app.on('window-all-closed', () => app.quit());

// Runs for every way of quitting (tray menu, window close on a client, OS shutdown).
app.on('will-quit', () => {
  for (const [local, fn] of watched) fs.unwatchFile(local, fn);
  stopResponder?.();
  host?.close();
});
