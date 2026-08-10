import { captureLiveCredentials, getActiveAccountId, listAccounts, loadAccount, saveAccount, updateAccountSession } from './accountStore.js';
import { getSessionTokens, resolveShard } from '../riot/auth.js';
import { fetchAccountProfile, fetchStorefront, getDailyOffers } from '../riot/store.js';
import { resolveDailyOffers } from '../riot/contentCache.js';

function expiry(accessToken) {
  try { return JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')).exp * 1000; } catch { return 0; }
}
async function resolvedStore(session) {
  const [storefront, profile] = await Promise.all([fetchStorefront(session), fetchAccountProfile(session)]);
  return {
    accountName: session.accountName ?? null,
    offers: await resolveDailyOffers(getDailyOffers(storefront)),
    expiresIn: storefront?.SkinsPanelLayout?.SingleItemOffersRemainingDurationInSeconds ?? null,
    profile
  };
}

export async function captureCurrentAccount(label) {
  const session = await getSessionTokens();
  const shard = await resolveShard(session);
  return persistCurrentAccount(label, { ...session, shard });
}

async function persistCurrentAccount(label, session) {
  const accounts = await listAccounts();
  const target = accounts.find((account) => account.label === label);
  const duplicate = accounts.find((account) => account.label !== label && account.puuid === session.puuid);
  if (duplicate) {
    throw new Error(`This Riot account is already saved as “${duplicate.label}”. It was not copied into “${label}”.`);
  }
  if (target?.puuid && target.puuid !== session.puuid) {
    throw new Error(`“${label}” is linked to a different Riot account. Its saved session was left unchanged.`);
  }
  const apiSession = { ...session, shard: session.shard, expiresAt: expiry(session.accessToken) };
  const credentials = await captureLiveCredentials();
  const account = await saveAccount(label, credentials, { accountName: session.accountName, puuid: session.puuid, apiSession });
  return { account, store: await resolvedStore(apiSession) };
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function waitForCurrentAccount(timeoutMs = 60_000, differentFromPuuid = null) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const session = await getSessionTokens();
      if (!differentFromPuuid || session.puuid !== differentFromPuuid) return { ...session, shard: await resolveShard(session) };
      lastError = new Error('Waiting for a different Riot account to finish signing in.');
    } catch (error) {
      lastError = error;
      await sleep(1_500);
    }
  }
  throw new Error(`Riot opened its sign-in screen or did not finish signing in within 60 seconds. Sign in manually, then use “Save current login” for this account. ${lastError?.message ?? ''}`.trim());
}

export async function addManualAccount(label) {
  const { openRiotSignIn } = await import('./switcher.js');
  await openRiotSignIn();
  const session = await waitForCurrentAccount(300_000);
  return persistCurrentAccount(label, session);
}

export async function refreshSwitchedAccount(label) {
  const session = await waitForCurrentAccount();
  return persistCurrentAccount(label, session);
}

export async function getSavedAccountStore(label) {
  const account = await loadAccount(label);
  if (!account.apiSession || account.apiSession.expiresAt <= Date.now()) {
    throw new Error('Saved API session expired. Switch to this account, then refresh and save it again.');
  }
  const store = await resolvedStore(account.apiSession);
  await updateAccountSession(label, { ...account.apiSession, accountName: store.accountName });
  return store;
}

export async function refreshAccountStore(label) {
  const account = await loadAccount(label);
  const activeId = await getActiveAccountId();
  if (account.id === activeId) {
    const refreshed = await captureCurrentAccount(label);
    return { store: refreshed.store, active: true };
  }
  return { store: await getSavedAccountStore(label), active: false };
}

export async function getDashboard() {
  const accounts = await listAccounts();
  const activeId = await getActiveAccountId();
  let livePuuid = null;
  try { livePuuid = (await getSessionTokens()).puuid; } catch { /* Riot Client may be at its sign-in screen. */ }
  const hydrated = await Promise.all(accounts.map(async (account) => {
    try {
      const saved = await loadAccount(account.label);
      return { account, storedPuuid: account.puuid ?? saved.apiSession?.puuid ?? null };
    } catch (error) { return { account, storedPuuid: null, loadError: error }; }
  }));
  const owners = new Map();
  return Promise.all(hydrated.map(async ({ account, storedPuuid, loadError }) => {
    const active = account.id === activeId && storedPuuid === livePuuid;
    if (loadError) return { ...account, active, status: 'error', error: loadError.message };
    if (storedPuuid && owners.has(storedPuuid)) {
      return { ...account, active: false, status: 'error', error: `This saved session duplicates “${owners.get(storedPuuid)}”. It was not loaded as a second account.` };
    }
    if (storedPuuid) owners.set(storedPuuid, account.label);
    try { return { ...account, active, status: 'ready', store: await getSavedAccountStore(account.label) }; }
    catch (error) { return { ...account, active, status: 'error', error: error.message }; }
  }));
}
