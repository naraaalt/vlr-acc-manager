import { app, BrowserWindow, Menu, powerMonitor } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipcHandlers.js';
import { sweepScratch } from './lib/housekeeping.js';
import { updateRoot } from './update/service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow = null;

// userData pin: the app was rebranded to "Sapphire", and Electron derives
// %APPDATA%\<name> from productName. Pinning keeps every saved account/session in
// the original folder across the rename. MUST run before app.whenReady() and any
// app.getPath('userData') use.
const LEGACY_USER_DATA_NAME = 'valorant-account-manager';
app.setPath('userData', path.join(app.getPath('appData'), LEGACY_USER_DATA_NAME));

// Single-instance lock. A second copy would load and re-save the same accounts index
// concurrently — the EPERM-on-rename failure the error panel explains — and could drive the
// Riot switcher at the same time as the first. MUST come AFTER the userData pin: the lock is
// keyed on the userData path, so taking it earlier would guard a directory the app does not use.
const isPrimaryInstance = app.requestSingleInstanceLock();

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#060B10',
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.on('maximize', () => window.webContents.send('window:maximized-changed', true));
  window.on('unmaximize', () => window.webContents.send('window:maximized-changed', false));
  // Menu is null, so the default F11 accelerator is gone — rebind it here.
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    }
  });
  if (devServerUrl) window.loadURL(devServerUrl);
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  return window;
}

if (!isPrimaryInstance) {
  // Another copy owns the data directory. Quit without opening a window or registering
  // handlers; the running copy comes forward through its own 'second-instance' event.
  app.quit();
} else {
  app.on('second-instance', () => focusMainWindow());

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    // Windows attributes notifications to the AppUserModelId. Without this the toast is
    // labelled "Electron" in dev and misses the app identity when packaged. Keep it equal
    // to electron-builder's appId.
    app.setAppUserModelId('com.naraaalt.valorantaccountmanager');
    registerIpcHandlers();
    mainWindow = createWindow();

    // Garbage from the PREVIOUS update is discarded here (the numbers belong to housekeeping.js). DELIBERATELY NOT
    // awaited and it never throws: nobody needs the result, the window must already be
    // visible, and housekeeping must not be the reason Sapphire fails to open. This sweep is also what
    // covers up for old builds, which do not know how to delete the installer.
    sweepScratch({ tempRoot: app.getPath('temp'), updateDir: updateRoot(app.getPath('temp')) })
      .then((swept) => {
        if (swept.bytes) console.log(`Reclaimed ${(swept.bytes / 1048576).toFixed(1)} MB of leftover update files.`);
      })
      .catch(() => {});

    // System sleep/resume: countdown, rate-limit map and Riot session state are all stale after
    // sleep. The renderer re-runs the progressive dashboard fetch and re-anchors its timers.
    powerMonitor.on('resume', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system:resumed', { resumedAt: Date.now() });
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
      else focusMainWindow();
    });
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
