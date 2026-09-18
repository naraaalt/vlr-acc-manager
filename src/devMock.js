// Dev-only mock of the electron/preload.cjs bridge.
// main.jsx installs it only when import.meta.env.DEV and window.valorant is
// absent, so this module is tree-shaken out of production builds.

const DASHBOARD_DELAY_MS = 0; // raise to e.g. 1500 to inspect the loading skeleton

// Tier: nilai asli dari valorant-api /v1/contenttiers. Kartu tanpa tier (null) adalah keadaan yang
// nyata — 40 dari 1405 skin Riot tidak punya contentTierUuid — jadi satu offer sengaja dibiarkan
// tanpa tier: kartunya harus tetap dirender, hanya tanpa warna.
const TIERS = {
  ultra: { rank: 4, label: 'Ultra Edition', color: '#FAD663' },
  exclusive: { rank: 3, label: 'Exclusive Edition', color: '#F5955B' },
  premium: { rank: 2, label: 'Premium Edition', color: '#D1548D' },
  deluxe: { rank: 1, label: 'Deluxe Edition', color: '#009587' },
  select: { rank: 0, label: 'Select Edition', color: '#5A9FE2' }
};

const OFFERS = [
  { id: 'mock-offer-1', name: 'Prime Vandal', image: null, price: 1775, tier: TIERS.premium },
  { id: 'mock-offer-2', name: 'Oni Phantom', image: null, price: 1775, tier: TIERS.exclusive },
  { id: 'mock-offer-3', name: 'Elderflame Operator', image: null, price: 2475, tier: TIERS.ultra },
  { id: 'mock-offer-4', name: 'Glitchpop Phantom', image: null, price: 2175, tier: null }
];

const RANKS = [
  { label: 'Rifat', accountName: 'Rifat#1337', level: 187, rank: 'Ascendant 2', rr: 42 },
  { label: 'Zyrox', accountName: 'Zyrox#6942', level: 143, rank: 'Diamond 1', rr: 78 },
  { label: 'Kaze', accountName: 'Kaze#2718', level: 221, rank: 'Immortal 3', rr: 156 },
  { label: 'Lynx', accountName: 'Lynx#8080', level: 96, rank: 'Gold 3', rr: 12 },
  { label: 'Sora', accountName: 'Sora#5555', level: 154, rank: 'Platinum 2', rr: 34 },
  { label: 'Neko', accountName: 'Neko#4201', level: 73, rank: 'Unranked', rr: null, placementsRemaining: 3 }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let accounts = [];
let counter = 0;

function freshStore(accountName) {
  return {
    accountName,
    offers: OFFERS.map((offer) => ({ ...offer })),
    expiresIn: 52_337,
    profile: null
  };
}

function makeReadyAccount(spec) {
  counter += 1;
  return {
    id: `mock-${counter}`,
    label: spec.label,
    accountName: spec.accountName,
    lastCheckedAt: new Date(Date.now() - (counter * 7 + 3) * 60_000).toISOString(),
    active: Boolean(spec.active),
    status: 'ready',
    error: null,
    store: {
      accountName: spec.accountName,
      offers: OFFERS.map((offer) => ({ ...offer })),
      expiresIn: 52_337,
      profile: {
        level: spec.level,
        rank: spec.rank,
        rr: spec.rr,
        placementsRemaining: spec.placementsRemaining ?? 0
      }
    }
  };
}

function makeErrorAccount() {
  counter += 1;
  return {
    id: `mock-${counter}`,
    label: 'Ghost',
    accountName: 'Ghost#0001',
    lastCheckedAt: new Date(Date.now() - 52 * 3600_000).toISOString(),
    active: false,
    status: 'error',
    error: 'The saved Riot session expired. Sign in to this account and sync again.',
    store: null
  };
}

function makeAccount(label) {
  return makeReadyAccount({ label, accountName: `${label}#0000`, level: 1, rank: 'Unranked', rr: null, placementsRemaining: 5 });
}

function respond(data = null) { return { ok: true, data }; }
function fail(error) { return { ok: false, error }; }
function findAccount(label) { return accounts.find((account) => account.label === label); }

function seed() {
  counter = 0;
  accounts = [
    ...RANKS.map((spec, index) => makeReadyAccount({ ...spec, active: index === 0 })),
    makeErrorAccount()
  ];
}

export function installDevMock() {
  if (typeof window === 'undefined' || window.valorant) return;
  seed();
  window.valorant = {
    getDashboard: async () => {
      if (DASHBOARD_DELAY_MS) await sleep(DASHBOARD_DELAY_MS);
      return respond({ accounts, session: { live: true } });
    },
    // Recorded so the headless harness can assert the rotation notice fired, or that it did
    // NOT: a call that returns true is indistinguishable from one never made.
    notifyStoreReset: async (payload) => { (window.__notifyCalls ??= []).push(payload ?? null); return respond(true); },
    // Update: dev tidak pernah menyentuh GitHub. `npm run dev` pakai jawaban tetap supaya UI-nya
    // bisa diperiksa tanpa network, dan supaya tidak ada request pihak ketiga dari dev.
    getAppVersion: async () => '0.1.2-dev',
    checkForUpdates: async () => respond({ available: false, currentVersion: '0.1.2-dev', latestVersion: null, reason: 'no-releases', installer: null, notes: null, publishedAt: null }),
    downloadUpdate: async () => fail('Dev mock: download disabled.'),
    installUpdate: async () => fail('Dev mock: install disabled.'),
    onUpdateProgress: () => {},
    captureCurrentAccount: async (label) => {
      accounts = accounts.filter((account) => account.label !== label);
      accounts = [makeAccount(label), ...accounts];
      return respond();
    },
    addManualAccount: async (label) => {
      if (findAccount(label)) return fail(`An account named “${label}” already exists.`);
      accounts = [...accounts, makeAccount(label)];
      return respond();
    },
    refreshAccountMarket: async (label) => {
      const account = findAccount(label);
      if (!account || account.status === 'error') return fail(`No store available for “${label}”.`);
      return respond({ active: account.active, store: freshStore(account.accountName) });
    },
    deleteAccount: async (label) => {
      accounts = accounts.filter((account) => account.label !== label);
      return respond();
    },
    renameAccount: async (oldLabel, newLabel) => {
      const target = findAccount(oldLabel);
      if (!target) return fail(`No saved account “${oldLabel}”.`);
      const trimmed = String(newLabel ?? '').trim();
      if (!trimmed || trimmed.length > 64) return fail('Account labels must be between 1 and 64 characters.');
      if (findAccount(trimmed)) return fail(`An account named “${trimmed}” already exists.`);
      accounts = accounts.map((account) => account.label === oldLabel ? { ...account, label: trimmed } : account);
      return respond();
    },
    switchAccount: async (label) => {
      if (!findAccount(label)) return fail(`No saved account “${label}”.`);
      accounts = accounts.map((account) => ({ ...account, active: account.label === label }));
      return respond();
    },
    // PLAY, mirroring the real backend: launch only for the account that owns the session,
    // report not-signed-in otherwise. Recorded the same way as notifyStoreReset, because a
    // launch is not observable from the renderer — a stub that silently succeeds is
    // indistinguishable from one never invoked. The mock never starts a game.
    playAccount: async (label) => {
      const target = findAccount(label);
      if (!target) return fail(`No saved account “${label}”.`);
      const running = Boolean(window.__valorantRunning);
      const switched = !target.active;
      (window.__playCalls ??= []).push({ label, active: Boolean(target.active), switched, running });
      if (target.active && running) return respond({ label, launched: false, switched: false, reason: 'already-running' });
      if (running) return respond({ label, launched: false, switched: false, reason: 'close-game-first' });
      return respond({ label, launched: true, switched, reason: null });
    },
    detectTcno: async () => respond({
      available: true,
      accounts: [
        { id: 'tcno-snapshot-1', name: 'TCNO Snapshot 1' },
        { id: 'tcno-snapshot-2', name: 'TCNO Snapshot 2' }
      ]
    }),
    importTcno: async (ids) => {
      const imported = (ids ?? []).map((id, index) => makeAccount(`TCNO ${index + 1}`));
      accounts = [...accounts, ...imported];
      return respond(ids ?? []);
    }
  };
}
