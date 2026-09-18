import { captureLiveCredentials, getActiveAccountId, listAccounts, loadAccount, saveAccount, updateAccountSession } from './accountStore.js';
import { getSessionTokens, resolveShard } from '../riot/auth.js';
import { fetchAccountProfile, fetchStorefront, getDailyOffers, nightMarketWindow } from '../riot/store.js';
import { resolveDailyOffersOrFallback, resolveNightMarketOrFallback } from '../riot/contentCache.js';
import { fail, classifyError } from '../lib/errorKind.js';

function expiry(accessToken) {
  try { return JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')).exp * 1000; } catch { return 0; }
}
async function resolvedStore(session) {
  const [storefront, profile] = await Promise.all([fetchStorefront(session), fetchAccountProfile(session)]);
  // Riot's storefront is the authoritative part: the offers and their prices come
  // from Riot itself. Names, images and showcase videos come from a third-party
  // content service, so losing that service degrades the labels on a store Riot
  // served perfectly well — it must not turn the account into an error.
  const { offers, contentUnavailable } = await resolveDailyOffersOrFallback(getDailyOffers(storefront));
  return {
    accountName: session.accountName ?? null,
    offers,
    contentUnavailable,
    nightMarket: await resolvedNightMarket(storefront),
    expiresIn: storefront?.SkinsPanelLayout?.SingleItemOffersRemainingDurationInSeconds ?? null,
    profile
  };
}

// Night Market tidak ada sepanjang sebagian besar tahun, jadi ini jauh lebih sering mengembalikan
// null daripada tidak — dan renderer memperlakukan null sebagai "tidak ada market", bukan sebagai
// kegagalan. Sengaja diselesaikan SETELAH daily store: storefront yang tidak bisa menghasilkan offer
// harian harus tetap menggagalkan akun ini seperti sebelumnya, bukan tertutupi oleh sebuah event yang
// kebetulan sedang berjalan.
async function resolvedNightMarket(storefront) {
  const market = nightMarketWindow(storefront);
  if (!market) return null;
  const { offers, contentUnavailable } = await resolveNightMarketOrFallback(market);
  return { offers, contentUnavailable, endsAt: market.endsAt };
}

// PUUID of the Riot Client session that is signed in right now, or null while
// the client sits at its sign-in screen (or is not running).
async function readLivePuuid() {
  try { return (await getSessionTokens()).puuid; } catch { return null; }
}

// Which saved account the live Riot Client session belongs to. The live
// session's PUUID is authoritative: VamAccountId.instance is only written by
// this app's own switcher, so it never marks an account signed in through Riot
// Client directly. The marker is the fallback while no session is readable.
function isLiveAccount(storedPuuid, id, livePuuid, activeId) {
  return livePuuid !== null ? storedPuuid === livePuuid : id === activeId;
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
    throw fail('duplicate', `This Riot account is already saved as “${duplicate.label}”. It was not copied into “${label}”.`);
  }
  if (target?.puuid && target.puuid !== session.puuid) {
    throw fail('duplicate', `“${label}” is linked to a different Riot account. Its saved session was left unchanged.`);
  }
  const apiSession = { ...session, shard: session.shard, expiresAt: expiry(session.accessToken) };
  const credentials = await captureLiveCredentials();
  const account = await saveAccount(label, credentials, { accountName: session.accountName, puuid: session.puuid, apiSession });
  return { account, store: await resolvedStore(apiSession) };
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForCurrentAccount(timeoutMs = 60_000, differentFromPuuid = null) {
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

async function getSavedAccountStore(label) {
  const account = await loadAccount(label);
  if (!account.apiSession || account.apiSession.expiresAt <= Date.now()) {
    throw fail('expired', 'Saved API session expired. Switch to this account, then refresh and save it again.');
  }
  const store = await resolvedStore(account.apiSession);
  await updateAccountSession(label, { ...account.apiSession, accountName: store.accountName });
  return store;
}

// Which signed-in account a record belongs to, resolved the same way the
// dashboard resolves it. Imported by the switcher so "is this account the live
// one?" has exactly one answer in the codebase.
export async function isAccountLive(account) {
  const storedPuuid = account.puuid ?? account.apiSession?.puuid ?? null;
  return isLiveAccount(storedPuuid, account.id, await readLivePuuid(), await getActiveAccountId());
}

export async function refreshAccountStore(label) {
  const account = await loadAccount(label);
  if (await isAccountLive(account)) {
    const refreshed = await captureCurrentAccount(label);
    return { store: refreshed.store, active: true };
  }
  return { store: await getSavedAccountStore(label), active: false };
}

export async function getDashboard(onProgress = null) {
  const accounts = await listAccounts();
  const activeId = await getActiveAccountId();
  const livePuuid = await readLivePuuid();
  const hydrated = await Promise.all(accounts.map(async (account) => {
    try {
      const saved = await loadAccount(account.label);
      return { account, storedPuuid: account.puuid ?? saved.apiSession?.puuid ?? null };
    } catch (error) { return { account, storedPuuid: null, loadError: error }; }
  }));
  const owners = new Map();
  const kindOf = (error) => (error?.kind ?? classifyError(error?.message));

  // Fetch stores one account at a time. Riot rate-limits bursts; N accounts ×
  // 2 requests in parallel is exactly the pattern that earns 429s. Each
  // resolved account is handed to onProgress so the renderer paints it
  // immediately instead of waiting for the whole batch.
  const loadOne = async ({ account, storedPuuid, loadError }) => {
    const active = isLiveAccount(storedPuuid, account.id, livePuuid, activeId);
    if (loadError) return { ...account, active, status: 'error', error: loadError.message, errorKind: kindOf(loadError) };
    if (storedPuuid && owners.has(storedPuuid)) {
      return { ...account, active: false, status: 'error', errorKind: 'duplicate', error: `This saved session duplicates “${owners.get(storedPuuid)}”. It was not loaded as a second account.` };
    }
    if (storedPuuid) owners.set(storedPuuid, account.label);
    try { return { ...account, active, status: 'ready', store: await getSavedAccountStore(account.label) }; }
    catch (error) { return { ...account, active, status: 'error', error: error.message, errorKind: kindOf(error) }; }
  };

  // The header pill and the per-account ONLINE badge answer different
  // questions, so both travel in the payload: `session.live` is true whenever
  // a Riot Client session is readable, even with no saved account at all.
  const dashboard = (loaded) => ({ accounts: loaded, session: { live: livePuuid !== null } });

  // No saved accounts yet: return an empty list. Falling through to the
  // stagger path would yield a one-element array holding undefined, which
  // crashes the renderer on its first account read (blank window).
  if (hydrated.length === 0) return dashboard([]);
  if (hydrated.length === 1) {
    // Single account: nothing to stagger.
    return dashboard(await Promise.all(hydrated.map(loadOne)));
  }
  const results = new Array(hydrated.length);
  // Fixed 350ms stagger + sequential start (each store fetch itself takes
  // 300-900ms, so this yields a comfortable gap between request pairs).
  let chain = Promise.resolve();
  hydrated.forEach((entry, index) => {
    chain = chain
      .then(() => (index === 0 ? null : sleep(350)))
      .then(async () => {
        results[index] = await loadOne(entry);
        onProgress?.({
          done: results.filter(Boolean).length,
          total: hydrated.length,
          account: results[index]
        });
      });
  });
  await chain;
  return dashboard(results);
}
