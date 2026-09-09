import { app, BrowserWindow, Menu, powerMonitor } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipcHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow = null;

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
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  createWindow();
  mainWindow = BrowserWindow.getAllWindows()[0];

  // System sleep/resume: all timers (countdown, rate-limit map) and the Riot
  // session state are stale after sleep. Tell the renderer to re-sync; it
  // re-runs the dashboard fetch (progressive) and re-anchors timers.
  powerMonitor.on('resume', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:resumed', { resumedAt: Date.now() });
    }
  });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
