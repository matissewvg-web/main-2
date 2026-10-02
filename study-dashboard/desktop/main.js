// Study Dashboard for Windows: a window around the synced web dashboard.
// Data lives in your claude.ai account, so this app and your iPhone show the same tests and sessions.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const DASHBOARD_URL = 'https://claude.ai/artifact/8GGFXkQTni7anqstyLqNBf';

// Hosts the main window may navigate to: the dashboard and the claude.ai sign-in flow.
const INSIDE = [/(^|\.)claude\.ai$/, /(^|\.)anthropic\.com$/, /^accounts\.google\.com$/, /^appleid\.apple\.com$/];

function isInside(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && INSIDE.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

// Present as regular Chrome so sign-in pages treat the window like a browser.
app.userAgentFallback = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#05040a',
    title: 'Study Dashboard',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInside(url)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#05040a' } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return;
    if (!isInside(url)) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), { query: { to: DASHBOARD_URL } });
  });

  win.loadURL(DASHBOARD_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
