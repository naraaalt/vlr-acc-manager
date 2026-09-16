// Regenerates dist/preview.html: a self-contained preview of the built app
// with a mocked window.valorant bridge — mirrors a real dashboard state:
// one healthy account, one errored account (EPERM on the index rename).
// Usage: npm run preview:mock   (after `npm run build`)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

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
const offerOf = (id, name, image, price, bare = false) => ({
  id: 'mock-' + id, name, image, price,
  video: bare ? null : (SHOWCASE[name]?.levels?.[0]?.video ?? null),
  levels: bare ? [] : (SHOWCASE[name]?.levels ?? []),
  chromas: bare ? [] : (SHOWCASE[name]?.chromas ?? []).filter((chroma) => chroma.swatch || chroma.render)
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
    active: false, status: 'error', lastCheckedAt: minutesAgo(2),
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
        offerOf('1', 'Reaver Vandal', 'https://media.valorant-api.com/weaponskinlevels/ba42fe63-457a-78ce-4499-47950a698129/displayicon.png', 1775),
        offerOf('2', 'Singularity Knife', 'https://media.valorant-api.com/weaponskinlevels/ea441610-42da-e46f-8d7b-1b9759c105cd/displayicon.png', 3550),
        offerOf('3', 'Prime Classic', 'https://media.valorant-api.com/weaponskinlevels/c7695ce7-4fc9-1c79-64b3-8c8f9e21571c/displayicon.png', 1275),
        offerOf('4', 'Prime Spectre', 'https://media.valorant-api.com/weaponskinlevels/d1d528ae-4dcc-e693-68e2-e8a475df83a4/displayicon.png', 1775),
        offerOf('5', 'Prime Axe', 'https://media.valorant-api.com/weaponskinlevels/f7c2e1e0-4c1e-6a11-9f0d-a75b4a6b1e11/displayicon.png', 1975, true)
      ]
    }
  },
  readyAccount('acc-zyrox', 'zyrox', 'Zyrox#6942', 128, 'Diamond 1', 78, 1775),
  readyAccount('acc-kaze', 'kaze', 'Kaze#2718', 201, 'Immortal 3', 156, 3550),
  readyAccount('acc-lynx', 'lynx', 'Lynx#8080', 87, 'Gold 3', 12, 1275)
];

const bridge = `
window.__notifyCalls = [];
window.valorant = {
  getDashboard: async () => ({ ok: true, data: { accounts: ${JSON.stringify(accounts)}, session: { live: true } } }),
  detectTcno: async () => ({ ok: true, data: { available: false, accounts: [] } }),
  refreshAccountMarket: async () => ({ ok: false, error: 'Preview mock: refresh disabled.' }),
  switchAccount: async () => ({ ok: false, error: 'Preview mock: switching disabled.' }),
  notifyStoreReset: async (payload) => { window.__notifyCalls.push(payload ?? {}); return { ok: true, data: true }; }
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
  setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })), 300);
  const variant = location.hash.split('-')[1];
  if (variant) setTimeout(() => {
    document.querySelectorAll('.sv-chroma')[Number(variant)]?.click();
  }, 1200);
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
if (location.hash === '#compact') {
  // Seed the store's own key BEFORE the app module runs. The qa hook block executes during
  // parsing and the app is a deferred module, so this exercises the real load path
  // (read -> sanitise -> apply at import) instead of poking the DOM directly.
  localStorage.setItem('vlr.settings', JSON.stringify({ density: true }));
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
              ...offer, name: 'Unknown skin', image: null, video: null, levels: [], chromas: []
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
  `<!doctype html><html><head><meta charset="UTF-8"><title>VLR PREVIEW</title><script>${bridge}</script>${tail}${qaHook}`);
console.log('dist/preview.html regenerated');
