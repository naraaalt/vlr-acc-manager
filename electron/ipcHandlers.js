import { BrowserWindow, ipcMain } from 'electron';
import { getSessionTokens, resolveShard } from './riot/auth.js';
import { fetchStorefront, getDailyOffers } from './riot/store.js';
import { resolveDailyOffers } from './riot/contentCache.js';
import { deleteAccount, renameAccount } from './accounts/accountStore.js';
import { addManualAccount, captureCurrentAccount, getDashboard, refreshAccountStore } from './accounts/accountService.js';
import { findTcnoAccounts, importTcnoAccounts } from './accounts/tcnoImport.js';
import { switchToAccount } from './accounts/switcher.js';
import { classifyError } from './lib/errorKind.js';

async function result(action) {
  try { return { ok: true, data: await action() }; }
  catch (error) {
    console.error('IPC request failed:', error.message);
    return { ok: false, error: error.message || 'The request failed.', errorKind: error.kind ?? classifyError(error.message) };
  }
}

export function registerIpcHandlers() {
  ipcMain.handle('store:current', async () => {
    try {
      const session = await getSessionTokens();
      const shard = await resolveShard(session);
      const storefront = await fetchStorefront({ ...session, shard });
      const offers = await resolveDailyOffers(getDailyOffers(storefront));
      return {
        ok: true,
        data: {
          accountName: session.accountName,
          offers,
          expiresIn: storefront?.SkinsPanelLayout?.SingleItemOffersRemainingDurationInSeconds ?? null
        }
      };
    } catch (error) {
      console.error('Failed to retrieve store:', error.message);
      return { ok: false, error: error.message || 'Unable to retrieve the current store.' };
    }
  });
  ipcMain.handle('accounts:dashboard', (event) => {
    const sender = event.sender;
    // Progressive load: forward each account as it resolves so the renderer
    // paints it immediately. The promise still resolves with the full set.
    return result(() => getDashboard((progress) => {
      if (!sender.isDestroyed()) sender.send('accounts:dashboard-progress', progress);
    }));
  });
  ipcMain.handle('accounts:capture-current', (_, label) => result(() => captureCurrentAccount(label)));
  ipcMain.handle('accounts:add-manually', (_, label) => result(() => addManualAccount(label)));
  ipcMain.handle('accounts:sync-current', (_, label) => result(() => captureCurrentAccount(label)));
  ipcMain.handle('accounts:refresh-market', (_, label) => result(() => refreshAccountStore(label)));
  ipcMain.handle('accounts:delete', (_, label) => result(async () => { await deleteAccount(label); return null; }));
  ipcMain.handle('accounts:rename', (_, oldLabel, newLabel) => result(async () => { await renameAccount(oldLabel, newLabel); return null; }));
  ipcMain.handle('accounts:switch', (_, label) => result(() => switchToAccount(label)));
  ipcMain.handle('accounts:tcno-detect', () => result(findTcnoAccounts));
  ipcMain.handle('accounts:tcno-import', (_, ids) => result(() => importTcnoAccounts(ids)));

  // Custom window controls (frameless title bar).
  ipcMain.handle('window:minimize', (event) => { BrowserWindow.fromWebContents(event.sender)?.minimize(); });
  ipcMain.handle('window:maximizeToggle', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.handle('window:close', (event) => { BrowserWindow.fromWebContents(event.sender)?.close(); });
  ipcMain.handle('window:isMaximized', (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false);
}
