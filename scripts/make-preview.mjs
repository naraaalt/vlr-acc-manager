// Regenerates dist/preview.html: a self-contained preview of the built app
// with a mocked window.valorant bridge — mirrors a real dashboard state:
// one healthy account, one errored account (EPERM on the index rename).
// Usage: npm run preview:mock   (after `npm run build`)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

// Versi di preview dibaca dari package.json, bukan ditulis sebagai literal. Dulu di sini tertulis
// '0.1.4' dan '0.1.5' langsung, dan akibatnya screenshot di docs/ ikut membusuk tanpa ada yang
// menyadarinya: settings.png masih mencetak 0.1.4 beberapa rilis setelah angka itu tidak benar lagi.
// Satu rilis berikutnya akan mengulanginya, karena tidak ada yang ingat memperbarui mock.
//
// Versi "yang tersedia" selalu satu patch di atas versi sekarang, supaya fixture update tetap masuk
// akal: penawaran update yang lebih tua dari app-nya bukan keadaan yang bisa terjadi.
const APP_VERSION = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const NEXT_VERSION = APP_VERSION.replace(/(\d+)$/, (patch) => String(Number(patch) + 1));

// Mockup penempatan tombol PLAY (QA-only, tidak ikut build produksi). Dipilih lewat #pv1..#pv5.
const playVariants = readFileSync(path.join(root, 'scripts', 'play-variants.js'), 'utf8');

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const HOME = 'C:/Users/rifat/AppData/Roaming/valorant-account-manager/accounts';
const VID = (uuid) => `https://valorant.dyn.riotcdn.net/x/videos/release-13.05/${uuid}_default_universal.mp4`;

// Real showcase material pulled from valorant-api (levels + chroma swatches).
const SHOWCASE = {
  'Reaver Vandal': {
    levels: [
      { name: 'Reaver Vandal', item: null, video: VID('a6ee2555-4e3a-049e-916a-7ca853dd4568'), icon: 'https://media.valorant-api.com/weaponskinlevels/ba42fe63-457a-78ce-4499-47950a698129/displayicon.png' },
      { name: 'Reaver Vandal Level 2', item: 'EEquippableSkinLevelItem::VFX', video: VID('78146b6e-49fc-115d-995e-309c5f18e3fd'), icon: null },
      { name: 'Reaver Vandal Level 3', item: 'EEquippableSkinLevelItem::Animation', video: VID('b21243ec-4cf0-37c0-43b4-15bf84de9d1d'), icon: null },
      { name: 'Reaver Vandal Level 4', item: 'EEquippableSkinLevelItem::Finisher', video: VID('d262fccc-465a-2da6-74ac-049ef3b3f759'), icon: null }
    ],
    chromas: [
      { name: 'Reaver Vandal', swatch: 'https://media.valorant-api.com/weaponskinchromas/2bd28382-48c6-8579-83e8-e9b64b783de3/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/2bd28382-48c6-8579-83e8-e9b64b783de3/fullrender.png' },
      { name: 'Reaver Vandal Level 4 (Variant 1 Red)', swatch: 'https://media.valorant-api.com/weaponskinchromas/b2a065c0-4632-ccaa-f496-7681dc2a6185/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/b2a065c0-4632-ccaa-f496-7681dc2a6185/fullrender.png' },
      { name: 'Reaver Vandal Level 4 (Variant 2 Black)', swatch: 'https://media.valorant-api.com/weaponskinchromas/db4461e5-40dd-1173-3b64-e5836f92f4dd/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/db4461e5-40dd-1173-3b64-e5836f92f4dd/fullrender.png' },
      { name: 'Reaver Vandal Level 4 (Variant 3 White)', swatch: 'https://media.valorant-api.com/weaponskinchromas/b2619c1c-4974-4f06-f37b-c68b1d6d7bd1/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/b2619c1c-4974-4f06-f37b-c68b1d6d7bd1/fullrender.png' }
    ]
  },
  'Singularity Knife': {
    levels: [
      { name: 'Singularity Knife', item: null, video: VID('758a25ed-43d8-ee80-bd15-1bba89d9d6c0'), icon: 'https://media.valorant-api.com/weaponskinlevels/ea441610-42da-e46f-8d7b-1b9759c105cd/displayicon.png' },
      { name: 'Singularity Knife Level 2', item: 'EEquippableSkinLevelItem::VFX', video: VID('290a2831-4bf2-1044-6377-ccbc6caa84dc'), icon: 'https://media.valorant-api.com/weaponskinlevels/34cdb942-4829-edbf-63ce-bfb3d993bdd1/displayicon.png' }
    ],
    chromas: [{ name: 'Singularity Knife', swatch: null }]
  },
  'Prime Classic': {
    levels: [
      { name: 'Prime Classic', item: null, video: VID('72d67dd0-0d79-4c98-9e1d-c10068b024a8'), icon: 'https://media.valorant-api.com/weaponskinlevels/c7695ce7-4fc9-1c79-64b3-8c8f9e21571c/displayicon.png' },
      { name: 'Prime Classic Level 2', item: 'EEquippableSkinLevelItem::VFX', video: VID('a670ee4b-a202-4c7f-8021-7e4e11840cff'), icon: 'https://media.valorant-api.com/weaponskinlevels/7b2c1232-460b-ab9a-1eca-55b5aee9ad08/displayicon.png' },
      { name: 'Prime Classic Level 3', item: 'EEquippableSkinLevelItem::Animation', video: VID('4c99c871-f3b6-4bcc-87ff-2c83adaac322'), icon: 'https://media.valorant-api.com/weaponskinlevels/4fc58223-43e7-a868-a6df-5e93be31369c/displayicon.png' },
      { name: 'Prime Classic Level 4', item: 'EEquippableSkinLevelItem::Finisher', video: VID('be82422e-f56b-4a8b-bc1b-b11d8e053618'), icon: 'https://media.valorant-api.com/weaponskinlevels/e8a35ddb-4ce7-3867-154c-94803ed12a24/displayicon.png' }
    ],
    chromas: [
      { name: 'Prime Classic', swatch: 'https://media.valorant-api.com/weaponskinchromas/d9dce0ec-464c-df67-63a3-1f9a05d322ad/swatch.png' },
      { name: 'Prime Classic Level 4 (Variant 1 Orange)', swatch: 'https://media.valorant-api.com/weaponskinchromas/42280760-422f-b5d1-4255-1e8993a817a4/swatch.png' },
      { name: 'Prime Classic Level 4 (Variant 2 Blue)', swatch: 'https://media.valorant-api.com/weaponskinchromas/02390051-4309-22d4-b733-c09fbfcf2e7f/swatch.png' },
      { name: 'Prime Classic Level 4 (Variant 3 Yellow)', swatch: 'https://media.valorant-api.com/weaponskinchromas/9fcc46a1-42f8-6407-787d-cb9d3e0bb718/swatch.png' }
    ]
  },
  'Prime Spectre': {
    levels: [
      { name: 'Prime Spectre', item: null, video: VID('0e21885e-9535-4445-8e0a-a221fffd0b3a'), icon: 'https://media.valorant-api.com/weaponskinlevels/d1d528ae-4dcc-e693-68e2-e8a475df83a4/displayicon.png' },
      { name: 'Prime Spectre Level 2', item: 'EEquippableSkinLevelItem::VFX', video: VID('f34ea8ed-01d5-4dd8-a59f-68fb31ecf23f'), icon: 'https://media.valorant-api.com/weaponskinlevels/d5b3f1de-413c-3b6b-1101-128d408647bf/displayicon.png' },
      { name: 'Prime Spectre Level 3', item: 'EEquippableSkinLevelItem::Animation', video: VID('924cdc06-0fff-4b95-9c34-1b170f37c488'), icon: 'https://media.valorant-api.com/weaponskinlevels/3546dc11-40fe-0ca9-2989-cd80fc53eccc/displayicon.png' },
      { name: 'Prime Spectre Level 4', item: 'EEquippableSkinLevelItem::Finisher', video: VID('b67e101e-32a1-43ae-97a8-565c41d9dbe0'), icon: 'https://media.valorant-api.com/weaponskinlevels/fefc628b-4078-c57b-dcc7-3591eca5c4d0/displayicon.png' }
    ],
    chromas: [
      { name: 'Prime Spectre', swatch: 'https://media.valorant-api.com/weaponskinchromas/48b6e421-4f93-5a00-62b3-20a1d320b040/swatch.png' },
      { name: 'Prime Spectre Level 4 (Variant 1 Orange)', swatch: 'https://media.valorant-api.com/weaponskinchromas/e6586300-4434-2dee-8867-45b47980f7a5/swatch.png' },
      { name: 'Prime Spectre Level 4 (Variant 2 Blue)', swatch: 'https://media.valorant-api.com/weaponskinchromas/f55e732b-4798-2f21-c099-f7ba8facc0bf/swatch.png' },
      { name: 'Prime Spectre Level 4 (Variant 3 Yellow)', swatch: 'https://media.valorant-api.com/weaponskinchromas/4c67e98b-4e1f-9f53-3163-16b393849f9d/swatch.png' }
    ]
  }
};
// Tier warna skin, nilai ASLI dari valorant-api /v1/contenttiers (diambil 2026-09-18).
// highlightColor Riot delapan digit (RRGGBBAA, alpha 33); yang dipakai enam digit pertamanya —
// sama seperti yang dilakukan electron/riot/contentCache.js saat membacanya.
const TIER = {
  ultra: { rank: 4, label: 'Ultra Edition', color: '#FAD663' },
  exclusive: { rank: 3, label: 'Exclusive Edition', color: '#F5955B' },
  premium: { rank: 2, label: 'Premium Edition', color: '#D1548D' },
  deluxe: { rank: 1, label: 'Deluxe Edition', color: '#009587' },
  select: { rank: 0, label: 'Select Edition', color: '#5A9FE2' }
};

const offerOf = (id, name, image, price, bare = false, tier = null) => ({
  id: 'mock-' + id, name, image, price, tier,
  video: bare ? null : (SHOWCASE[name]?.levels?.[0]?.video ?? null),
  levels: bare ? [] : (SHOWCASE[name]?.levels ?? []),
  chromas: bare ? [] : (SHOWCASE[name]?.chromas ?? []).filter((chroma) => chroma.swatch || chroma.render)
});

// Night Market: enam offer, satu per tier kecuali Premium yang dapat dua, dan tepat SATU yang sudah
// dilihat — dua keadaan yang dirender berbeda oleh halaman (tanda OPENED, dan urutan di dalam tier).
// Ditulis dalam urutan yang mungkin dikirim Riot, yaitu TIDAK terurut: halaman yang mengurutkan, dan
// fixture yang datang sudah terurut akan membuat sortir yang belum tersambung terlihat bekerja.
// Perhatikan nm-p1 (Reaver, -34%) sengaja ada SETELAH nm-p2 (Prime Spectre, -40%): keduanya Premium,
// jadi diskon yang menentukan — persis yang diperiksa probe.
const NIGHT_MARKET_OFFERS = [
  { id: 'nm-e', tier: TIER.exclusive, name: 'Singularity Knife', image: 'https://media.valorant-api.com/weaponskinlevels/ea441610-42da-e46f-8d7b-1b9759c105cd/displayicon.png', price: 2274, originalPrice: 2675, discountPercent: 15, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-d', tier: TIER.deluxe, name: 'Comet Vandal', image: 'https://media.valorant-api.com/weaponskinlevels/e271a430-4282-847b-3a51-5d97839ce221/displayicon.png', price: 638, originalPrice: 1275, discountPercent: 50, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-p1', tier: TIER.premium, name: 'Reaver Vandal', image: 'https://media.valorant-api.com/weaponskinlevels/ba42fe63-457a-78ce-4499-47950a698129/displayicon.png', price: 1172, originalPrice: 1775, discountPercent: 34, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-s', tier: TIER.select, name: 'MK.VII Liberty Vandal', image: 'https://media.valorant-api.com/weaponskinlevels/6dee8259-4620-920a-cef7-14944bbed130/displayicon.png', price: 613, originalPrice: 875, discountPercent: 30, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-u', tier: TIER.ultra, name: 'Elderflame Vandal', image: 'https://media.valorant-api.com/weaponskinlevels/18609205-4edb-5966-cff8-0fba0230ba1e/displayicon.png', price: 1856, originalPrice: 2475, discountPercent: 25, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-p2', tier: TIER.premium, name: 'Prime Spectre', image: 'https://media.valorant-api.com/weaponskinlevels/d1d528ae-4dcc-e693-68e2-e8a475df83a4/displayicon.png', price: 1065, originalPrice: 1775, discountPercent: 40, seen: true, video: null, levels: [], chromas: [] }
];
// endsAt dihitung ulang tiap kali preview dimuat, jadi hitungannya selalu punya ~13 hari di atasnya
// dan halaman tidak pernah memulai dalam keadaan "sudah berakhir".
const nightMarketFixture = () => ({
  endsAt: Date.now() + (12 * 24 * 3600_000) + (22 * 3600_000) + (41 * 60_000),
  contentUnavailable: false,
  offers: NIGHT_MARKET_OFFERS.map((offer) => ({ ...offer }))
});

// A ready account with a small store. Levels/ranks differ across the fixture so
// every sort mode produces a visibly different order.
const readyAccount = (id, label, accountName, level, rank, rr, price) => ({
  id, label, accountName, puuid: `puuid-${id}`,
  active: false, status: 'ready', lastCheckedAt: minutesAgo(30), error: null,
  store: {
    accountName, expiresIn: 52337,
    profile: { level, rank, rr, placementsRemaining: 0 },
    offers: [
      offerOf(id, 'Prime Classic', 'https://media.valorant-api.com/weaponskinlevels/c7695ce7-4fc9-1c79-64b3-8c8f9e21571c/displayicon.png', price)
    ]
  }
});

const accounts = [
  {
    id: 'acc-glue', label: 'i eat glue', accountName: 'i eat glue#EATER', puuid: 'puuid-glue',
    // errorKind is not decoration: the real dashboard attaches one to EVERY error row, and the
    // renderer decides from it whether the row can be launched from. A fixture that carries the
    // message without the kind is more lenient than the backend and renders the wrong control.
    active: false, status: 'error', errorKind: 'fs-error', lastCheckedAt: minutesAgo(2),
    error: `EPERM: operation not permitted, rename '${HOME}/index.vam.0d5a62b8-30a6-4b66-8d67-a74f423ecfba.tmp' -> '${HOME}/index.vam'`,
    store: null
  },
  {
    id: 'acc-main', label: 'main', accountName: 'Main#SEVEN', puuid: 'puuid-main',
    active: true, status: 'ready', lastCheckedAt: minutesAgo(2), error: null,
    store: {
      accountName: 'Main#SEVEN', expiresIn: 52337,
      profile: { level: 121, rank: 'Diamond 2', rr: 85, placementsRemaining: 0 },
      offers: [
        offerOf('1', 'Reaver Vandal', 'https://media.valorant-api.com/weaponskinlevels/ba42fe63-457a-78ce-4499-47950a698129/displayicon.png', 1775, false, TIER.premium),
        offerOf('2', 'Singularity Knife', 'https://media.valorant-api.com/weaponskinlevels/ea441610-42da-e46f-8d7b-1b9759c105cd/displayicon.png', 3550, false, TIER.exclusive),
        // Dua kartu terakhir sengaja TIDAK memakai tier asli skinnya (Prime Classic dan Prime Spectre
        // dua-duanya Premium). Lima kartu Premium hanya akan memperlihatkan satu warna, sementara
        // fixture ini ada untuk memperlihatkan tampilannya — jadi rentangnya disebar ke Ultra dan
        // Deluxe, dan kartu terakhir sengaja dibiarkan tanpa tier supaya keadaan "Riot tidak
        // mendaftarkan tier untuk skin ini" ikut terlihat di layar.
        offerOf('3', 'Prime Classic', 'https://media.valorant-api.com/weaponskinlevels/c7695ce7-4fc9-1c79-64b3-8c8f9e21571c/displayicon.png', 1275, false, TIER.ultra),
        offerOf('4', 'Prime Spectre', 'https://media.valorant-api.com/weaponskinlevels/d1d528ae-4dcc-e693-68e2-e8a475df83a4/displayicon.png', 1775, false, TIER.deluxe),
        offerOf('5', 'Prime Axe', 'https://media.valorant-api.com/weaponskinlevels/f7c2e1e0-4c1e-6a11-9f0d-a75b4a6b1e11/displayicon.png', 1975, true, null)
      ],
      // Night Market hanya dipasang di akun 'main', supaya "satu akun punya, yang lain tidak" juga
      // terlihat di layar — dan supaya keadaan null (tanpa market) tetap terwakili oleh akun lain.
      nightMarket: nightMarketFixture()
    }
  },
  readyAccount('acc-zyrox', 'zyrox', 'Zyrox#6942', 128, 'Diamond 1', 78, 1775),
  readyAccount('acc-kaze', 'kaze', 'Kaze#2718', 201, 'Immortal 3', 156, 3550),
  readyAccount('acc-lynx', 'lynx', 'Lynx#8080', 87, 'Gold 3', 12, 1275)
];

const bridge = `
window.__notifyCalls = [];
window.__updateCalls = [];
window.__playCalls = [];
window.__updateProgressCb = null;
// Whether a game is open right now. A hash hook rather than a constant, because two of
// PLAY's four outcomes only exist while something is running and neither would ever render
// from the default fixture.
window.__valorantRunning = location.hash === '#running';
// Live list, so the mutating methods below really change what the next getDashboard
// returns. Inlining it into getDashboard (as this used to) made delete and rename
// unverifiable from the preview: the renderer made the call and the list never changed,
// which looks exactly like a broken setting.
window.__previewAccounts = ${JSON.stringify(accounts)};
window.valorant = {
  getDashboard: async () => ({ ok: true, data: { accounts: window.__previewAccounts, session: { live: location.hash !== '#nosession' } } }),
  detectTcno: async () => ({ ok: true, data: { available: false, accounts: [] } }),
  refreshAccountMarket: async () => ({ ok: false, error: 'Preview mock: refresh disabled.' }),
  switchAccount: async () => ({ ok: false, error: 'Preview mock: switching disabled.' }),
  // PLAY mirrors the real backend: one press switches Riot Client to the account first when
  // that account does not own the session, then launches. It refuses in the two cases the
  // backend refuses in — the game is already open under the signed-in account, or switching
  // would close the game that is open under another one. A mock that always succeeded would
  // show a healthy button for states the backend would never honour.
  playAccount: async (label) => {
    const target = window.__previewAccounts.find((account) => account.label === label);
    if (!target) return { ok: false, error: 'No saved account “' + label + '”.' };
    const running = Boolean(window.__valorantRunning);
    const switched = !target.active;
    window.__playCalls.push({ label: label, active: Boolean(target.active), switched: switched, running: running });
    if (target.active && running) return { ok: true, data: { label: label, launched: false, switched: false, reason: 'already-running' } };
    if (running) return { ok: true, data: { label: label, launched: false, switched: false, reason: 'close-game-first' } };
    return { ok: true, data: { label: label, launched: true, switched: switched, reason: null } };
  },
  notifyStoreReset: async (payload) => { window.__notifyCalls.push(payload ?? {}); return { ok: true, data: true }; },
  getAppVersion: async () => '${APP_VERSION}',
  // Registered, not ignored: the pill's DOWNLOADING n% is the whole progress report during an
  // update, so a mock that swallows the callback makes the feature look inert from the preview
  // — and "the preview shows nothing" is exactly the symptom the real thing had.
  onUpdateProgress: (callback) => { window.__updateProgressCb = callback; },
  downloadUpdate: async () => {
    window.__updateCalls.push('download');
    // #update-fail: the download refuses, which must not look like "nothing happened" — the
    // pill goes back to offering the version and a toast says what went wrong.
    if (location.hash.startsWith('#update-fail')) {
      return { ok: false, error: 'The installer download failed (HTTP 503).' };
    }
    // #update-slow holds the download open and emits progress, so the mid-download state can be
    // looked at. Without it the mock resolves instantly and that state never renders.
    if (location.hash.startsWith('#update-slow')) {
      const total = 96_000_000;
      for (let step = 1; step <= 8; step += 1) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        window.__updateProgressCb?.({ received: Math.round((total / 8) * step), total: total });
      }
    }
    return { ok: true, data: { path: 'X:/fake/Sapphire Setup ${NEXT_VERSION}.exe', bytes: 1, name: 'Sapphire Setup ${NEXT_VERSION}.exe' } };
  },
  installUpdate: async () => { window.__updateCalls.push('install'); return { ok: true, data: { helperPid: 1 } }; },
  checkForUpdates: async () => {
    window.__updateCalls.push('check');
    // Opt-in lewat hash: default preview TIDAK menampilkan pill, supaya screenshot keadaan
    // normal tidak tiba-tiba menampilkan penawaran update.
    if (location.hash.startsWith('#update')) {
      return { ok: true, data: { available: true, currentVersion: '${APP_VERSION}', latestVersion: '${NEXT_VERSION}', reason: 'ok',
        installer: { name: 'Sapphire Setup ${NEXT_VERSION}.exe', url: 'https://example.invalid/setup.exe', size: 96_000_000, digest: 'sha256:${'a'.repeat(64)}' },
        notes: null, publishedAt: null } };
    }
    return { ok: true, data: { available: false, currentVersion: '${APP_VERSION}', latestVersion: null, reason: 'no-releases', installer: null, notes: null, publishedAt: null } };
  },
  deleteAccount: async (label) => {
    const before = window.__previewAccounts.length;
    window.__previewAccounts = window.__previewAccounts.filter((account) => account.label !== label);
    return window.__previewAccounts.length === before
      ? { ok: false, error: 'No saved account “' + label + '”.' }
      : { ok: true, data: null };
  },
  renameAccount: async (oldLabel, newLabel) => {
    const target = window.__previewAccounts.find((account) => account.label === oldLabel);
    if (!target) return { ok: false, error: 'No saved account “' + oldLabel + '”.' };
    target.label = newLabel;
    return { ok: true, data: null };
  }
};
// QA hook #reset: shift Date.now so the app believes it is a few seconds before
// the next 00:00 UTC rotation. Real time then carries the countdown across the
// boundary, exercising the whole chain (tick -> crossedStoreReset -> notify +
// refresh) without waiting for midnight or touching the system clock.
if (location.hash === '#reset') {
  const realNowFn = Date.now.bind(Date);
  const realNow = realNowFn();
  const at = new Date(realNow);
  const midnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1);
  const offset = (midnight - 5000) - realNow;
  Date.now = () => realNowFn() + offset;
}
`;

const index = readFileSync(path.join(dist, 'index.html'), 'utf8');
const moduleTag = '<script type="module"';
const tail = moduleTag + index.split(moduleTag)[1];
// QA hook: opening preview.html#preview auto-presses [P] once the app is up,
// so the showcase modal can be screenshot-verified headlessly.
const qaHook = `<script>
if (location.hash.startsWith('#preview')) {
  // Kartu daily store tidak lagi memilih dirinya sendiri saat aplikasi dibuka, dan [P] sengaja diam
  // saat tidak ada kartu yang ditunjuk. Hook ini karena itu menunjuk kartu pertama dulu — panah
  // kanan dari kursor kosong — baru menekan [P], persis urutan yang dilakukan user.
  //
  // Dua hal yang tidak datang bersamaan, dan keduanya pernah bikin hook ini diam-diam gagal:
  //
  // 1. Skeleton loading juga merender .cards .card (tanpa .num). Menunggu .cards .card berarti
  //    menunggu placeholder, dan selama skeleton itu daftar offer-nya masih kosong — panah dan [P]
  //    dua-duanya no-op, tanpa error, cuma screenshot dashboard.
  // 2. Kartu nyata bisa tampil satu frame SEBELUM ref keymap menunjuk closure render terbaru
  //    (ref-nya di-update di effect, bukan saat render). Keydown yang mendarat di frame itu ditelan
  //    tanpa jejak. Terukur di mesin ini: ~15ms setelah kartu muncul, dan tidak ada hubungannya
  //    dengan fokus jendela — di halaman yang sudah settle, tekan pertama selalu diterima.
  //
  // Karena itu panahnya DIULANG sampai kursornya benar-benar bergerak, dan [P] diulang sampai
  // modalnya benar-benar ada. Menekan sekali lalu berharap cuma memindahkan tebakan 300ms ke tempat
  // lain. [P] idempoten (ia menyetel offer, tidak pernah menutup), jadi mengulangnya aman.
  const press = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  const modalOpen = () => {
    const modal = document.querySelector('.skin-modal');
    return Boolean(modal) && modal.getBoundingClientRect().width > 0;
  };
  const openModal = (attempt = 0) => {
    if (modalOpen() || attempt >= 60) return;
    press('p');
    setTimeout(() => openModal(attempt + 1), 100);
  };
  const pointAtCard = (attempt = 0) => {
    if (document.querySelector('.card.cur')) { openModal(); return; }
    if (attempt >= 60) return;
    press('ArrowRight');
    setTimeout(() => pointAtCard(attempt + 1), 100);
  };
  const waitForCards = (attempt = 0) => {
    if (!document.querySelector('.cards .card .num')) {
      if (attempt < 100) setTimeout(() => waitForCards(attempt + 1), 100);
      return;
    }
    pointAtCard();
  };
  waitForCards();
  const variant = location.hash.split('-')[1];
  if (variant) {
    // Chroma cuma ada di dalam modal, jadi yang ditunggu swatch-nya — bukan jam. 1200ms tetap
    // adalah tebakan yang sama rapuhnya, dan #preview-slow menahan playback 5 detik.
    const waitForSwatches = (attempt = 0) => {
      const swatches = document.querySelectorAll('.sv-chroma');
      if (!swatches.length) {
        if (attempt < 100) setTimeout(() => waitForSwatches(attempt + 1), 100);
        return;
      }
      swatches[Number(variant)]?.click();
    };
    waitForSwatches();
  }
}
if (location.hash === '#skeleton') {
  // Freeze the loading state: never resolve getDashboard.
  window.valorant.getDashboard = () => new Promise(() => {});
}
if (location.hash === '#dash-error') {
  // Global dashboard failure: renders the ACCOUNTS UNAVAILABLE panel, which is
  // the only branch that mounts .error-actions.
  window.valorant.getDashboard = async () => ({
    ok: false, errorKind: 'network',
    error: 'The Riot service took too long to respond. Please try again.'
  });
}
if (location.hash === '#night') {
  // Klik kontrol pintu masuknya yang asli, sampai halaman ter-mount — cara yang sama dengan
  // #settings membuka panel: event keyboard sintetis menyala sebelum React memasang keymap-nya dan
  // tidak berefek.
  const timer = setInterval(() => {
    const entry = document.querySelector('.rs-nm');
    if (!entry) return;
    clearInterval(timer);
    entry.click();
  }, 300);
}
if (location.hash === '#night-ended') {
  // Jendela yang akhirnya sudah lewat: pintunya harus HILANG dari baris refresh, dan halamannya
  // tidak boleh mencetak hitungan negatif.
  const realDashboard = window.valorant.getDashboard;
  window.valorant.getDashboard = async () => {
    const payload = await realDashboard();
    if (!payload?.ok) return payload;
    return { ...payload, data: { ...payload.data, accounts: payload.data.accounts.map((account) => account.store?.nightMarket
      ? { ...account, store: { ...account.store, nightMarket: { ...account.store.nightMarket, endsAt: Date.now() - 1000 } } }
      : account) } };
  };
}
if (location.hash === '#night-none') {
  // Tidak ada night market di mana pun — keadaan sepanjang sebagian besar tahun, dan satu-satunya
  // yang harus identik dengan aplikasi sebelum fitur ini ada.
  const realDashboard = window.valorant.getDashboard;
  window.valorant.getDashboard = async () => {
    const payload = await realDashboard();
    if (!payload?.ok) return payload;
    return { ...payload, data: { ...payload.data, accounts: payload.data.accounts.map((account) => account.store
      ? { ...account, store: { ...account.store, nightMarket: null } }
      : account) } };
  };
}
if (location.hash === '#settings') {
  // Click the real header control until the panel is mounted, rather than firing a
  // synthetic keydown: synthetic keys fire before React mounts the keymap and no-op.
  const timer = setInterval(() => {
    const button = document.querySelector('.hdr-settings');
    if (!button) return;
    clearInterval(timer);
    button.click();
  }, 300);
}
if (location.hash.startsWith('#rotation')) {
  // Land the clock 5s before the next 00:00 UTC so REAL time carries the app across the
  // boundary within seconds (the tick is 1s), exercising tick -> crossedStoreReset -> the
  // rotation effect end to end. Query params seed the two settings that effect reads:
  // ?notify=0 and ?autosync=0 turn them off.
  const realNow = Date.now;
  const nextMidnight = Math.ceil(realNow() / 86400000) * 86400000;
  const offset = nextMidnight - 5000 - realNow();
  Date.now = () => realNow() + offset;
  const params = new URLSearchParams(location.search);
  const seeded = (() => { try { return JSON.parse(localStorage.getItem('vlr.settings') || '{}'); } catch { return {}; } })();
  if (params.has('notify')) seeded.notifyOnRotation = params.get('notify') !== '0';
  if (params.has('autosync')) seeded.autoSyncOnRotation = params.get('autosync') !== '0';
  localStorage.setItem('vlr.settings', JSON.stringify(seeded));
  // Record every toast, because the rotation toast can expire before the harness reads the
  // DOM — a probe that samples once cannot tell "never shown" from "shown and gone".
  window.__toasts = [];
  new MutationObserver(() => {
    const el = document.querySelector('.toast');
    const text = el ? el.textContent : null;
    if (text && window.__toasts[window.__toasts.length - 1] !== text) window.__toasts.push(text);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}
if (location.hash === '#no-content') {
  // The content service is down: Riot's storefront still answered, so the store
  // renders with unknown names and no previews, plus the note explaining why.
  // This is the only branch that mounts that note.
  const realDashboard = window.valorant.getDashboard;
  window.valorant.getDashboard = async () => {
    const payload = await realDashboard();
    if (!payload?.ok) return payload;
    return {
      ...payload,
      data: {
        ...payload.data,
        accounts: payload.data.accounts.map((account) => account.store ? {
          ...account,
          store: {
            ...account.store,
            contentUnavailable: true,
            offers: account.store.offers.map((offer) => ({
              ...offer, name: 'Unknown skin', image: null, video: null, levels: [], chromas: [], tier: null
            }))
          }
        } : account)
      }
    };
  };
}
if (location.hash.startsWith('#theme-')) {
  // Flip theme by clicking the header switch until its label matches the
  // requested theme — robust against mount timing (no keyboard listener yet).
  const target = location.hash.split('-')[1] === 'vlr' ? 'VLR' : 'SAPPHIRE';
  const timer = setInterval(() => {
    const btn = document.querySelector('.theme-switch');
    if (!btn) return;
    if (btn.textContent.trim().includes(target)) { clearInterval(timer); return; }
    btn.click();
  }, 400);
}
if (location.hash === '#preview-slow') {
  // Throttle playback start so the sweep loader stays visible ~5s for QA.
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const r = origPlay.call(this);
    return new Promise((resolve) => setTimeout(() => resolve(r), 5000));
  };
}
if (location.hash === '#confirm') {
  // Open the custom confirm dialog: click the selected account's SWITCH button.
  setTimeout(() => {
    document.querySelector('.acct.sel .acct-actions button')?.click();
  }, 1500);
}
</script>`;
writeFileSync(path.join(dist, 'preview.html'),
  `<!doctype html><html><head><meta charset="UTF-8"><title>VLR PREVIEW</title><script>${bridge}</script>${tail}${qaHook}<script>${playVariants}</script>`);
console.log('dist/preview.html regenerated');
