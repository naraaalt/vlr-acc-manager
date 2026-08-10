import { ipcMain } from 'electron';
import { getSessionTokens, resolveShard } from './riot/auth.js';
import { fetchStorefront, getDailyOffers } from './riot/store.js';
import { resolveDailyOffers } from './riot/contentCache.js';
import { deleteAccount } from './accounts/accountStore.js';
import { addManualAccount, captureCurrentAccount, getDashboard, refreshAccountStore } from './accounts/accountService.js';
import { findTcnoAccounts, importTcnoAccounts } from './accounts/tcnoImport.js';
import { switchToAccount } from './accounts/switcher.js';

async function result(action) {
  try { return { ok: true, data: await action() }; }
  catch (error) { console.error('IPC request failed:', error.message); return { ok: false, error: error.message || 'The request failed.' }; }
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
  ipcMain.handle('accounts:dashboard', () => result(getDashboard));
  ipcMain.handle('accounts:capture-current', (_, label) => result(() => captureCurrentAccount(label)));
  ipcMain.handle('accounts:add-manually', (_, label) => result(() => addManualAccount(label)));
  ipcMain.handle('accounts:sync-current', (_, label) => result(() => captureCurrentAccount(label)));
  ipcMain.handle('accounts:refresh-market', (_, label) => result(() => refreshAccountStore(label)));
  ipcMain.handle('accounts:delete', (_, label) => result(async () => { await deleteAccount(label); return null; }));
  ipcMain.handle('accounts:switch', (_, label) => result(() => switchToAccount(label)));
  ipcMain.handle('accounts:tcno-detect', () => result(findTcnoAccounts));
  ipcMain.handle('accounts:tcno-import', (_, ids) => result(() => importTcnoAccounts(ids)));
}
