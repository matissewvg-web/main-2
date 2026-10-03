// Pillage Ransack for Windows: the whole game in a window, no sign-in, no internet needed.
// game.html is ../index.html copied in at build time; campaigns are saved in this app's
// own storage on the PC. Shared online play stays on the claude.ai version (menu: Play online).
const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const ONLINE_URL = 'https://claude.ai/artifact/713o1Dh2t4C3TVXNggtPVV';
const RELEASES_URL = 'https://github.com/matissewvg-web/main-2/releases/tag/pillage-ransack';

// Packaged: game.html sits next to this file. From a checkout (npm start): use ../index.html.
function gameFile() {
  const bundled = path.join(__dirname, 'game.html');
  return fs.existsSync(bundled) ? bundled : path.join(__dirname, '..', 'index.html');
}

let win = null;

function openOutside(url) {
  if (/^https?:/.test(url)) shell.openExternal(url);
}

function buildMenu() {
  const template = [
    {
      label: 'Game',
      submenu: [
        { label: 'Play online (shared campaigns)', click: () => openOutside(ONLINE_URL) },
        { label: 'Check for a newer version', click: () => openOutside(RELEASES_URL) },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom', label: 'Actual size' },
        { role: 'zoomIn', label: 'Zoom in' },
        { role: 'zoomOut', label: 'Zoom out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Full screen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#1b1713',
    title: 'Pillage Ransack',
    icon: path.join(__dirname, 'icon.png'),
    // Menu stays visible: it holds "Play online" for shared campaigns.
    autoHideMenuBar: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  // The game never opens windows of its own; any link goes to the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return;
    event.preventDefault();
    openOutside(url);
  });

  win.loadFile(gameFile(), { query: { desktop: '1' } });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    buildMenu();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
