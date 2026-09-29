// Regenerates dist/preview.html: a self-contained preview of the built app
// with a mocked window.valorant bridge — mirrors a real dashboard state:
// one healthy account, one errored account (EPERM on the index rename).
// Usage: node scripts/make-preview.mjs   (after `npm run build`)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

// The preview version is read from package.json, not written as a literal. This used to hardcode
// '0.1.4' and '0.1.5' right here, and the screenshots in docs/ rotted along with it unnoticed:
// settings.png still printed 0.1.4 several releases after that number stopped being true.
// The next release would repeat it, because nobody remembers to update the mock.
//
// The "available" version is always one patch above the current version, so the update fixture stays
// plausible: an update offer older than the app itself is not a state that can happen.
const APP_VERSION = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const NEXT_VERSION = APP_VERSION.replace(/(\d+)$/, (patch) => String(Number(patch) + 1));

// Mockup of PLAY button placement (QA-only, not part of the production build). Selected via #pv1..#pv5.
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
// Skin colour tiers, REAL values from valorant-api /v1/contenttiers (fetched 2026-09-18).
// Riot's highlightColor is eight digits (RRGGBBAA, alpha 33); only the first six are used —
// the same thing electron/riot/contentCache.js does when it reads them.
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

// Night Market: six offers, one per tier except Premium which gets two, and exactly ONE already
// seen — two states the page renders differently (the OPENED mark, and the order within a tier).
// Written in an order Riot might send, i.e. NOT sorted: the page does the sorting, and a fixture
// that arrives pre-sorted would make the not-yet-wired sort look like it works.
// Note nm-p1 (Reaver, -34%) deliberately sits AFTER nm-p2 (Prime Spectre, -40%): both are Premium,
// so the discount decides — exactly what the probe checks.
const NIGHT_MARKET_OFFERS = [
  { id: 'nm-e', tier: TIER.exclusive, name: 'Singularity Knife', image: 'https://media.valorant-api.com/weaponskinlevels/ea441610-42da-e46f-8d7b-1b9759c105cd/displayicon.png', price: 2274, originalPrice: 2675, discountPercent: 15, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-d', tier: TIER.deluxe, name: 'Comet Vandal', image: 'https://media.valorant-api.com/weaponskinlevels/860afab6-4496-389c-1c86-4fbcf0ea24c7/displayicon.png', price: 638, originalPrice: 1275, discountPercent: 50, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-p1', tier: TIER.premium, name: 'Reaver Vandal', image: 'https://media.valorant-api.com/weaponskinlevels/ba42fe63-457a-78ce-4499-47950a698129/displayicon.png', price: 1172, originalPrice: 1775, discountPercent: 34, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-s', tier: TIER.select, name: 'MK.VII Liberty Vandal', image: 'https://media.valorant-api.com/weaponskinlevels/cb713a25-4a6c-7ab0-213e-878977dced63/displayicon.png', price: 613, originalPrice: 875, discountPercent: 30, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-u', tier: TIER.ultra, name: 'Elderflame Vandal', image: 'https://media.valorant-api.com/weaponskinlevels/b3d3ff38-4202-20d8-2f41-c783477e5636/displayicon.png', price: 1856, originalPrice: 2475, discountPercent: 25, seen: false, video: null, levels: [], chromas: [] },
  { id: 'nm-p2', tier: TIER.premium, name: 'Prime Spectre', image: 'https://media.valorant-api.com/weaponskinlevels/d1d528ae-4dcc-e693-68e2-e8a475df83a4/displayicon.png', price: 1065, originalPrice: 1775, discountPercent: 40, seen: true, video: null, levels: [], chromas: [] }
];
// endsAt is recomputed every time the preview loads, so the countdown always has ~13 days on it
// and the page never starts out in the "already ended" state.
const nightMarketFixture = () => ({
  endsAt: Date.now() + (12 * 24 * 3600_000) + (22 * 3600_000) + (41 * 60_000),
  contentUnavailable: false,
  offers: NIGHT_MARKET_OFFERS.map((offer) => ({ ...offer }))
});

// Showcase material for the bundle's own skins, pulled from valorant-api the same way the daily
// store entries above are. Names are collapsed the way the main process collapses them (the raw
// chroma names carry CRLF, and a label with a newline in it renders as a two-line button).
const ELDERFLAME = {
  'Elderflame Vandal': {
    image: 'https://media.valorant-api.com/weaponskins/18609205-4edb-5966-cff8-0fba0230ba1e/displayicon.png',
    levels: [
      { name: "Elderflame Vandal", item: null, video: VID('7cf0f6c2-af1e-47db-9d85-f1a130267cc7'), icon: 'https://media.valorant-api.com/weaponskinlevels/b3d3ff38-4202-20d8-2f41-c783477e5636/displayicon.png' },
      { name: "Elderflame Vandal Level 2", item: 'EEquippableSkinLevelItem::VFX', video: VID('05c87353-f55c-4ad6-aa65-f3335dbf3a5a'), icon: 'https://media.valorant-api.com/weaponskinlevels/d86e4684-47d3-9a2f-9bd4-01ae3fd3e183/displayicon.png' },
      { name: "Elderflame Vandal Level 3", item: 'EEquippableSkinLevelItem::Animation', video: VID('f41600f0-4e3b-40f8-88cd-605cc2d00354'), icon: 'https://media.valorant-api.com/weaponskinlevels/77569f90-4e7f-7d91-bd18-2aa12bdba709/displayicon.png' },
      { name: "Elderflame Vandal Level 4", item: 'EEquippableSkinLevelItem::Finisher', video: VID('71127731-9ce5-4f7a-b9ae-dc55dfe7d9b4'), icon: 'https://media.valorant-api.com/weaponskinlevels/4fb025db-471f-3891-6e30-b98866abb2f9/displayicon.png' },
    ],
    chromas: [
      { name: "Elderflame Vandal", swatch: 'https://media.valorant-api.com/weaponskinchromas/835ad8e3-4b0e-071b-ce38-00a05032ac43/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/835ad8e3-4b0e-071b-ce38-00a05032ac43/fullrender.png' },
      { name: "Elderflame Vandal Level 4 (Variant 1 Red)", swatch: 'https://media.valorant-api.com/weaponskinchromas/a9873bd5-41f9-170d-27f0-abb68fea0ce9/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/a9873bd5-41f9-170d-27f0-abb68fea0ce9/fullrender.png' },
      { name: "Elderflame Vandal Level 4 (Variant 2 Blue)", swatch: 'https://media.valorant-api.com/weaponskinchromas/6fb459fa-4368-7d20-106a-629db9825a2b/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/6fb459fa-4368-7d20-106a-629db9825a2b/fullrender.png' },
      { name: "Elderflame Vandal Level 4 (Variant 3 Dark)", swatch: 'https://media.valorant-api.com/weaponskinchromas/403f7d3e-4e96-6566-42f3-01b7a803d660/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/403f7d3e-4e96-6566-42f3-01b7a803d660/fullrender.png' },
    ]
  },
  'Elderflame Judge': {
    image: 'https://media.valorant-api.com/weaponskins/0221b120-444b-6d1b-fc50-e4a98e470eb2/displayicon.png',
    levels: [
      { name: "Elderflame Judge", item: null, video: VID('9bc9589a-a2c4-43f4-a29a-8d1d6b09a763'), icon: 'https://media.valorant-api.com/weaponskinlevels/d8c9fee3-4e02-bc92-a235-608a556905ae/displayicon.png' },
      { name: "Elderflame Judge Level 2", item: 'EEquippableSkinLevelItem::VFX', video: VID('00c0a699-a900-4671-b763-f7090473b2fc'), icon: 'https://media.valorant-api.com/weaponskinlevels/640764d8-495d-3663-27ab-b99f5f2466d6/displayicon.png' },
      { name: "Elderflame Judge Level 3", item: 'EEquippableSkinLevelItem::Animation', video: VID('b44b0756-a59c-4f92-9906-c4e72e201806'), icon: 'https://media.valorant-api.com/weaponskinlevels/d95e4b3c-4081-4005-cae7-14b890046b4f/displayicon.png' },
      { name: "Elderflame Judge Level 4", item: 'EEquippableSkinLevelItem::Finisher', video: VID('51da2dd8-00cb-43d2-b13b-b55ab4646d29'), icon: 'https://media.valorant-api.com/weaponskinlevels/d41a4383-4c15-4c3f-1f16-4fbb4fb36ed8/displayicon.png' },
    ],
    chromas: [
      { name: "Elderflame Judge", swatch: 'https://media.valorant-api.com/weaponskinchromas/72b9e3f7-427f-3d24-f618-11b0f28feb89/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/72b9e3f7-427f-3d24-f618-11b0f28feb89/fullrender.png' },
      { name: "Elderflame Judge Level 4 (Variant 1 Red)", swatch: 'https://media.valorant-api.com/weaponskinchromas/87e27487-4705-8060-5d07-c6a6dc927f09/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/87e27487-4705-8060-5d07-c6a6dc927f09/fullrender.png' },
      { name: "Elderflame Judge Level 4 (Variant 2 Blue)", swatch: 'https://media.valorant-api.com/weaponskinchromas/ede643c7-4b83-0fd4-13d1-1c9ddb4d34cd/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/ede643c7-4b83-0fd4-13d1-1c9ddb4d34cd/fullrender.png' },
      { name: "Elderflame Judge Level 4 (Variant 3 Dark)", swatch: 'https://media.valorant-api.com/weaponskinchromas/ec9caa7a-43ff-8f04-52a7-27a46de24f6e/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/ec9caa7a-43ff-8f04-52a7-27a46de24f6e/fullrender.png' },
    ]
  },
  'Elderflame Frenzy': {
    image: 'https://media.valorant-api.com/weaponskins/4fb9ea7d-45a6-9154-7a46-648781b081c4/displayicon.png',
    levels: [
      { name: "Elderflame Frenzy", item: null, video: VID('83783875-f20d-499e-add9-bee9cb81f01e'), icon: 'https://media.valorant-api.com/weaponskinlevels/ea65ba94-468d-39a8-5ded-98820d72d19f/displayicon.png' },
      { name: "Elderflame Frenzy Level 2", item: 'EEquippableSkinLevelItem::VFX', video: VID('bd9b6542-8e87-412f-89ef-9af59c11b062'), icon: null },
      { name: "Elderflame Frenzy Level 3", item: 'EEquippableSkinLevelItem::Animation', video: VID('340f4fa7-7eca-4c63-b8c3-938a01302947'), icon: null },
      { name: "Elderflame Frenzy Level 4", item: 'EEquippableSkinLevelItem::Finisher', video: VID('bc78c474-4ce3-4cb6-a887-8d3da7694780'), icon: null },
    ],
    chromas: [
      { name: "Elderflame Frenzy", swatch: 'https://media.valorant-api.com/weaponskinchromas/eee0c458-474a-b80f-871c-c188f3929a79/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/eee0c458-474a-b80f-871c-c188f3929a79/fullrender.png' },
      { name: "Elderflame Frenzy Level 4 (Variant 1 Red)", swatch: 'https://media.valorant-api.com/weaponskinchromas/f40759fa-4a3a-3bb1-484e-4fabf878a774/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/f40759fa-4a3a-3bb1-484e-4fabf878a774/fullrender.png' },
      { name: "Elderflame Frenzy Level 4 (Variant 2 Blue)", swatch: 'https://media.valorant-api.com/weaponskinchromas/a0e8d567-4673-2f0c-7bb0-debb86d3f4ef/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/a0e8d567-4673-2f0c-7bb0-debb86d3f4ef/fullrender.png' },
      { name: "Elderflame Frenzy Level 4 (Variant 3 Dark)", swatch: 'https://media.valorant-api.com/weaponskinchromas/3f8b9999-4a92-de0a-8a0a-4ebf04258950/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/3f8b9999-4a92-de0a-8a0a-4ebf04258950/fullrender.png' },
    ]
  },
  'Elderflame Operator': {
    image: 'https://media.valorant-api.com/weaponskins/d722313d-43cb-b38d-7841-75880a3ed2cb/displayicon.png',
    levels: [
      { name: "Elderflame Operator", item: null, video: VID('0e1f79a5-81ae-4d21-b3c5-740605b7e054'), icon: 'https://media.valorant-api.com/weaponskinlevels/5c273d0e-47fa-bb8c-d914-728de95da30e/displayicon.png' },
      { name: "Elderflame Operator Level 2", item: 'EEquippableSkinLevelItem::VFX', video: VID('3b406376-1546-4295-a6d9-77a9a286d724'), icon: null },
      { name: "Elderflame Operator Level 3", item: 'EEquippableSkinLevelItem::Animation', video: VID('f5a28688-6a1c-41cb-88b5-a6f8990bf4da'), icon: null },
      { name: "Elderflame Operator Level 4", item: 'EEquippableSkinLevelItem::Finisher', video: VID('9662e509-fba3-409d-b4c4-87b0c7279792'), icon: null },
    ],
    chromas: [
      { name: "Elderflame Operator", swatch: 'https://media.valorant-api.com/weaponskinchromas/61583c81-4332-ff81-2ede-2a8248863c80/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/61583c81-4332-ff81-2ede-2a8248863c80/fullrender.png' },
      { name: "Elderflame Operator Level 4 (Variant 1 Red)", swatch: 'https://media.valorant-api.com/weaponskinchromas/a8b125e5-4e33-953d-d02c-37ad9e284b6a/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/a8b125e5-4e33-953d-d02c-37ad9e284b6a/fullrender.png' },
      { name: "Elderflame Operator Level 4 (Variant 2 Blue)", swatch: 'https://media.valorant-api.com/weaponskinchromas/37cca29b-4468-a01e-e31b-8f8978a81eef/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/37cca29b-4468-a01e-e31b-8f8978a81eef/fullrender.png' },
      { name: "Elderflame Operator Level 4 (Variant 3 Dark)", swatch: 'https://media.valorant-api.com/weaponskinchromas/296dcddb-4fbf-8834-bc01-44acac66dc60/swatch.png', video: null, render: 'https://media.valorant-api.com/weaponskinchromas/296dcddb-4fbf-8834-bc01-44acac66dc60/fullrender.png' },
    ]
  },
  'Elderflame Dagger': {
    image: 'https://media.valorant-api.com/weaponskins/94b40026-4efb-39ea-69d7-fca60be39c56/displayicon.png',
    levels: [
      { name: "Elderflame Dagger", item: null, video: VID('282c7f4a-bc4f-424a-a40d-b87ac5210ba9'), icon: 'https://media.valorant-api.com/weaponskinlevels/f3594bcc-43a9-4a74-8c40-98a4e4a4569a/displayicon.png' },
      { name: "Elderflame Dagger Level 2", item: 'EEquippableSkinLevelItem::VFX', video: VID('97510dc2-457c-4b55-8737-14646b3e05e9'), icon: 'https://media.valorant-api.com/weaponskinlevels/ef028ac5-40a2-bc8e-582b-c4abf4ed0ef3/displayicon.png' },
    ],
    chromas: [
    ]
  },
};

// Featured bundle: Elderflame, with REAL art and showcase from the same source as the offers above.
// Its price is copied from the shape Riot sends — four skins at full price, one melee at full price
// but flagged promo, and three accessories priced 0, and that difference is exactly the bundle
// discount. The Dagger is deliberately Exclusive-tiered while the bundle is Ultra: that is a real
// state, and the reason each card's colour always comes from the ITEM's tier, not the bundle's.
//
// Riot's own item type ids, from the category table of the owned-items endpoint. Used here for the
// same reason as in the main process: when an id fails to resolve, its type still tells you WHAT
// the item is. A fixture that carries no type id would hide that path entirely.
const SKIN_TYPE = 'e7c63390-eda7-46e0-bb7a-a6abdacd2433';
const BUDDY_TYPE = 'dd3bf334-87f3-40bd-b043-682a57a8dc3a';
const SPRAY_TYPE = 'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475';
const CARD_TYPE = '3f296c07-64c3-494c-923b-fe692a4fa1bd';
// The same mapping the main process applies, interpolated into the #no-content hook below so the
// simulated outage degrades the bundle the way the real resolver does.
const ITEM_TYPE_KINDS = {
  [SKIN_TYPE]: 'skin', [BUDDY_TYPE]: 'buddy', [SPRAY_TYPE]: 'spray', [CARD_TYPE]: 'card'
};

const BUNDLE_ITEMS = [
  { id: 'bundle-vandal', skin: 'Elderflame Vandal', tier: TIER.ultra, price: 2475, basePrice: 2475, included: false, itemTypeId: SKIN_TYPE },
  { id: 'bundle-operator', skin: 'Elderflame Operator', tier: TIER.ultra, price: 2475, basePrice: 2475, included: false, itemTypeId: SKIN_TYPE },
  { id: 'bundle-judge', skin: 'Elderflame Judge', tier: TIER.ultra, price: 2475, basePrice: 2475, included: false, itemTypeId: SKIN_TYPE },
  // One level with no video — the REAL shape of a skin with no showcase: of Riot's 1405 skins,
  // 827 have no video on any level, and ALL of them have exactly one level. An empty array never
  // happens in real data; what is below is what happens.
  { id: 'bundle-frenzy', skin: 'Elderflame Frenzy', levels: [{ name: 'Elderflame Frenzy', item: null, video: null, icon: null }], tier: TIER.ultra, price: 2475, basePrice: 2475, included: false, itemTypeId: SKIN_TYPE },
  { id: 'bundle-dagger', skin: 'Elderflame Dagger', tier: TIER.exclusive, price: 0, basePrice: 4950, included: true, itemTypeId: SKIN_TYPE },
  { id: 'bundle-buddy', kind: 'buddy', name: 'Elderflame Buddy', image: 'https://media.valorant-api.com/buddies/38a10a3b-495c-eeff-b8af-c3b2b5cdc3f9/displayicon.png', tier: null, price: 0, basePrice: 475, included: true, itemTypeId: BUDDY_TYPE },
  { id: 'bundle-spray', kind: 'spray', name: 'Elderflame Spray', image: 'https://media.valorant-api.com/sprays/0221e96d-49be-a601-52d6-ef8270773276/displayicon.png', tier: null, price: 0, basePrice: 325, included: true, itemTypeId: SPRAY_TYPE },
  { id: 'bundle-card', kind: 'card', name: 'Elderflame Card', image: 'https://media.valorant-api.com/playercards/6e3d1cd3-4494-8b21-cbc7-0797e8de75db/largeart.png', tier: null, price: 0, basePrice: 375, included: true, itemTypeId: CARD_TYPE },
];

// Skin items take their label, art, video and variants from ELDERFLAME; the accessory kinds have
// none of those and carry `kind` plus `image` alone — which is exactly what the page renders without
// a PREVIEW button. The bundle-level tier is the first item whose tier resolves, as in the main
// process, so the fixture cannot disagree with the resolver about which colour the chip is.
//
// `levels` on an entry is an override, not a copy: it is how the Frenzy is given no showcase at all.
// 827 of Riot's 1405 skins have no video on any level, every one of them with exactly one level, and
// a SKIN in that state is the one case the accessory rows cannot stand in for — it has to render NO
// SHOWCASE VIDEO and no PREVIEW button while still being a skin with a tier and a price.
const bundleFixture = () => {
  const items = BUNDLE_ITEMS.map((entry) => {
    const source = entry.skin ? ELDERFLAME[entry.skin] : null;
    const levels = entry.levels ?? source?.levels ?? [];
    return {
      id: entry.id,
      kind: entry.skin ? 'skin' : entry.kind ?? 'other',
      itemTypeId: entry.itemTypeId,
      name: entry.name ?? entry.skin,
      image: entry.image ?? source?.image ?? null,
      video: entry.levels ? null : (levels[0]?.video ?? null),
      levels,
      chromas: entry.levels ? [] : (source?.chromas ?? []),
      tier: entry.tier,
      price: entry.price,
      basePrice: entry.basePrice,
      discountPercent: 0,
      included: entry.included,
      quantity: 1
    };
  });
  const baseTotal = items.reduce((sum, item) => sum + (item.basePrice ?? 0), 0);
  const price = items.reduce((sum, item) => sum + (item.price ?? item.basePrice ?? 0), 0);
  return {
    id: 'mock-bundle-elderflame',
    name: 'Elderflame',
    art: {
      wide: 'https://media.valorant-api.com/bundles/1ba50cf0-46dd-848f-13a9-dc92fb0a3e3b/displayicon2.png',
      tall: 'https://media.valorant-api.com/bundles/1ba50cf0-46dd-848f-13a9-dc92fb0a3e3b/verticalpromoimage.png',
      logo: null
    },
    items,
    baseTotal,
    price,
    // COMPUTED here, the same way the main process does. Written as a literal, this fixture could
    // stay "correct" while the page computes it wrong.
    discountPercent: baseTotal > 0 && price < baseTotal ? Math.round((1 - price / baseTotal) * 100) : null,
    // Four days out, recomputed every time the preview loads, so the page never starts out in the
    // "already ended" state.
    endsAt: Date.now() + (4 * 24 * 3600_000) + (6 * 3600_000),
    endsInSeconds: 4 * 24 * 3600 + 6 * 3600,
    contentUnavailable: false
  };
};

// A SECOND bundle, because Riot runs a promo bundle alongside the main one and a single-bundle
// fixture cannot show the two doors or the page picking between them. Smaller and more heavily
// discounted on purpose, and with a SHORTER window — that is what the live payload does, and it is
// why each page prints its own countdown instead of one shared figure.
const promoBundleFixture = () => {
  const items = [
    {
      id: 'promo-skin', kind: 'skin', itemTypeId: SKIN_TYPE,
      name: 'Galleria Warden', image: 'https://media.valorant-api.com/weaponskinlevels/2f3f4a4a-4c5a-4f5f-8a1a-1b2c3d4e5f60/displayicon.png',
      video: null, levels: [], chromas: [], tier: TIER.select,
      price: 525, basePrice: 875, discountPercent: 0, included: false, quantity: 1
    },
    {
      id: 'promo-buddy', kind: 'buddy', itemTypeId: BUDDY_TYPE,
      name: 'Warden Buddy', image: null, video: null, levels: [], chromas: [], tier: null,
      price: 0, basePrice: 475, discountPercent: 0, included: true, quantity: 1
    },
    {
      id: 'promo-spray', kind: 'spray', itemTypeId: SPRAY_TYPE,
      name: 'Warden Spray', image: null, video: null, levels: [], chromas: [], tier: null,
      price: 0, basePrice: 325, discountPercent: 0, included: true, quantity: 1
    }
  ];
  const baseTotal = items.reduce((sum, item) => sum + (item.basePrice ?? 0), 0);
  const price = items.reduce((sum, item) => sum + (item.price ?? item.basePrice ?? 0), 0);
  return {
    id: 'mock-bundle-warden',
    name: 'Warden Launch',
    art: { wide: null, tall: null, logo: null },
    items,
    baseTotal,
    price,
    discountPercent: Math.round((1 - price / baseTotal) * 100),
    endsAt: Date.now() + (2 * 24 * 3600_000),
    endsInSeconds: 2 * 24 * 3600,
    contentUnavailable: false
  };
};

// A ready account with a small store. Levels/ranks differ across the fixture so
// every sort mode produces a visibly different order.
const readyAccount = (id, label, accountName, level, rank, rr, price) => ({
  id, label, accountName, puuid: `puuid-${id}`,
  active: false, status: 'ready', lastCheckedAt: minutesAgo(30), error: null,
  store: {
    accountName, expiresIn: 52337,
    profile: { level, rank, rr, placementsRemaining: 0 },
    bundles: [bundleFixture(), promoBundleFixture()],
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
      bundles: [bundleFixture(), promoBundleFixture()],
      offers: [
        offerOf('1', 'Reaver Vandal', 'https://media.valorant-api.com/weaponskinlevels/ba42fe63-457a-78ce-4499-47950a698129/displayicon.png', 1775, false, TIER.premium),
        offerOf('2', 'Singularity Knife', 'https://media.valorant-api.com/weaponskinlevels/ea441610-42da-e46f-8d7b-1b9759c105cd/displayicon.png', 3550, false, TIER.exclusive),
        // The last two cards deliberately do NOT use their skin's real tier (Prime Classic and Prime
        // Spectre are both Premium). Five Premium cards would only ever show one colour, while this
        // fixture exists to show what the display looks like — so the range is spread over Ultra and
        // Deluxe, and the last card is deliberately left with no tier so the "Riot registers no tier
        // for this skin" state shows on screen too.
        offerOf('3', 'Prime Classic', 'https://media.valorant-api.com/weaponskinlevels/c7695ce7-4fc9-1c79-64b3-8c8f9e21571c/displayicon.png', 1275, false, TIER.ultra),
        offerOf('4', 'Prime Spectre', 'https://media.valorant-api.com/weaponskinlevels/d1d528ae-4dcc-e693-68e2-e8a475df83a4/displayicon.png', 1775, false, TIER.deluxe),
        offerOf('5', 'Prime Axe', 'https://media.valorant-api.com/weaponskinlevels/249b0e46-4a11-f045-51bb-649151cd802a/displayicon.png', 1975, true, null)
      ],
      // The Night Market is only attached to the 'main' account, so "one account has it, the others
      // don't" also shows on screen — and the null state (no market) stays represented by the rest.
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
  // Switching is part of what the preview has to exercise: the open store page follows the account the
  // session moves to, and a mock that refuses every switch makes that unverifiable. It flips the active
  // flag on the live list exactly as src/devMock.js does — it does not restart Riot Client, because
  // nothing running in a browser can.
  switchAccount: async (label) => {
    const target = window.__previewAccounts.find((account) => account.label === label);
    if (!target) return { ok: false, error: 'No saved account “' + label + '”.' };
    window.__previewAccounts = window.__previewAccounts.map((account) => ({ ...account, active: account.label === label }));
    // Same shape the real main process returns, including the moved flag, so the follow-the-switch
    // path is exercised here rather than only on a real account switch.
    return { ok: true, data: { label: label, store: null, moved: true, refreshError: null } };
  },
  // PLAY mirrors the real backend: one press switches Riot Client to the account first when
  // that account does not own the session, then launches. It refuses in the two cases the
  // backend refuses in — the game is already open under the signed-in account, or switching
  // would close the game that is open under another one. A mock that always succeeded would
  // show a healthy button for states the backend would never honour.
  //
  // The switch really moves the session, exactly as switchAccount above does, because the
  // renderer re-reads the dashboard after a PLAY that switched: a mock that only reported
  // the switched flag would hand it a dashboard still naming the previous account as active.
  playAccount: async (label) => {
    const target = window.__previewAccounts.find((account) => account.label === label);
    if (!target) return { ok: false, error: 'No saved account “' + label + '”.' };
    const running = Boolean(window.__valorantRunning);
    const switched = !target.active;
    window.__playCalls.push({ label: label, active: Boolean(target.active), switched: switched, running: running });
    if (target.active && running) return { ok: true, data: { label: label, launched: false, switched: false, reason: 'already-running' } };
    if (running) return { ok: true, data: { label: label, launched: false, switched: false, reason: 'close-game-first' } };
    if (switched) window.__previewAccounts = window.__previewAccounts.map((account) => ({ ...account, active: account.label === label }));
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
    // Opt-in via hash: the default preview does NOT show the pill, so screenshots of the normal
    // state don't suddenly show an update offer.
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
  // The daily store card no longer selects itself when the app opens, and [P] deliberately stays quiet
  // when no card is pointed at. This hook therefore points at the first card first — the right
  // arrow from an empty cursor — then presses [P], exactly the order a user performs.
  //
  // Two timing traps have each made this hook silently fail:
  //
  // 1. The loading skeleton also renders .cards .card (without .num). Waiting for .cards .card means
  //    waiting for the placeholder, and while that skeleton is up the offer list is still empty — the
  //    arrow and [P] are both no-ops, with no error, just a dashboard screenshot.
  // 2. A real card can appear one frame BEFORE the keymap ref points at the newest render closure
  //    (the ref is updated in an effect, not during render). A keydown landing on that frame is
  //    swallowed without a trace. Measured on this machine: ~15ms after the card appears, unrelated
  //    to window focus — on a settled page the first press is always accepted.
  //
  // So the arrow is REPEATED until the cursor actually moves, and [P] until the modal actually exists;
  // pressing once just relocates the 300ms guess. [P] is idempotent, so repeating it is safe.
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
    // Chroma only exists inside the modal, so what is awaited is the swatches — not a timer. 1200ms is still
    // the same fragile guess, and #preview-slow holds playback for 5 seconds.
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
  // Click the real entry control, until the page is mounted — the same way
  // #settings opens the panel: a synthetic keyboard event fires before React mounts its keymap and
  // has no effect.
  const timer = setInterval(() => {
    const entry = document.querySelector('.rs-nm');
    if (!entry) return;
    clearInterval(timer);
    entry.click();
  }, 300);
}
if (location.hash === '#bundle') {
  // Same as #night: the control is clicked, not a synthetic keydown. What is awaited is .rs-bundle,
  // not .rs-entries — the slot is rendered even when empty, so waiting for it means waiting for
  // the placeholder and the click never happens.
  const timer = setInterval(() => {
    const entry = document.querySelector('.rs-bundle');
    if (!entry) return;
    clearInterval(timer);
    entry.click();
  }, 300);
}
if (location.hash === '#bundle-none') {
  // No bundle anywhere: the entry must be GONE from the refresh row and there is no way into
  // its page. This is the state outside a bundle sale, i.e. most of the time.
  const realDashboard = window.valorant.getDashboard;
  window.valorant.getDashboard = async () => {
    const payload = await realDashboard();
    if (!payload?.ok) return payload;
    return { ...payload, data: { ...payload.data, accounts: payload.data.accounts.map((account) => account.store
      ? { ...account, store: { ...account.store, bundles: [] } }
      : account) } };
  };
}
if (location.hash === '#night-ended') {
  // A window that has finally passed: the entry must be GONE from the refresh row, and its page
  // must not print a negative count.
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
  // No night market anywhere — the state for most of the year, and the only one
  // that must be identical to the app before this feature existed.
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
  //
  // The bundle degrades exactly the way the main process degrades it: labels, art and tier go, and
  // the ids, prices, totals and window stay. Anything else would be a fixture that is kinder than
  // the backend — the numbers are Riot's, and losing the third-party labels must not lose them.
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
            })),
            bundles: account.store.bundles.map((bundle) => ({
              ...bundle,
              name: 'Unknown bundle',
              art: { wide: null, tall: null, logo: null },
              contentUnavailable: true,
              items: bundle.items.map((item) => ({
                ...item,
                // The KIND survives the outage, exactly as the main process now resolves it: Riot's
                // ItemTypeID still says what the object is even when no list can name it. Hardcoding
                // 'other' here would simulate a degradation the resolver does not actually produce,
                // and the card would read "ITEM" for a buddy.
                kind: (${JSON.stringify(ITEM_TYPE_KINDS)})[item.itemTypeId] ?? 'other',
                name: 'Unknown item', image: null, video: null, levels: [], chromas: [], tier: null
              }))
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
