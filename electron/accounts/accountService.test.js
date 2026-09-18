import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Tes ini menembus jalur NYATA main process dari ujung ke ujung: storefront Riot -> parse store ->
// hias lewat indeks konten -> payload yang diterima renderer. Yang di-mock hanya dua hal yang memang
// menyentuh mesin ini (berkas akun dan lockfile Riot Client); permintaan HTTP-nya tidak, karena justru
// sambungan itulah yang belum pernah diuji.
//
// Kenapa ini ada: `nightMarket` ditambahkan sebagai field keempat di payload store, dan tidak ada
// satu pun tes yang memeriksa bahwa field itu benar-benar sampai ke renderer. Kalau namanya salah
// ketik atau lupa di-await, semuanya tetap hijau — tes store.js lulus sendiri, tes contentCache.js
// lulus sendiri — dan yang hilang cuma fitur yang tidak muncul di layar saat event berikutnya buka.
vi.mock('./accountStore.js', () => ({
  captureLiveCredentials: vi.fn(async () => ({ cookie: 'mock' })),
  getActiveAccountId: vi.fn(async () => 'id-main'),
  listAccounts: vi.fn(async () => []),
  loadAccount: vi.fn(async () => ({ apiSession: null })),
  saveAccount: vi.fn(async () => ({ id: 'id-main' })),
  updateAccountSession: vi.fn(async () => undefined)
}));
vi.mock('../riot/auth.js', () => ({
  getSessionTokens: vi.fn(async () => ({ puuid: null })),
  resolveShard: vi.fn(async () => 'na')
}));

const PREMIUM_TIER_UUID = 'tier-premium';
const REAVER_LEVEL = 'level-reaver';
const ONI_LEVEL = 'level-oni';
const PUUID = 'puuid-main';

// Dua minggu dalam detik, seperti yang Riot kirim untuk Night Market.
const MARKET_SECONDS = 12 * 24 * 3600 + 22 * 3600;

function bonusOffer(levelId, { cost, discounted, percent, seen }) {
  return {
    BonusOfferID: `bonus-${levelId}`,
    Offer: { OfferID: `offer-${levelId}`, Cost: { '85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741': cost }, Rewards: [{ ItemID: levelId, ItemTypeID: 'type' }] },
    DiscountCosts: { '85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741': discounted },
    DiscountPercent: percent,
    IsSeen: seen
  };
}

const storefrontWith = (extra = {}) => ({
  SkinsPanelLayout: {
    SingleItemOffers: [REAVER_LEVEL],
    SingleItemStoreOffers: [{ OfferID: REAVER_LEVEL, Cost: { vp: 1775 } }],
    SingleItemOffersRemainingDurationInSeconds: 52_337
  },
  ...extra
});

function stubRiot({ storefront, contentOk = true, storefrontOk = true } = {}) {
  const skins = [
    {
      displayName: 'Reaver Vandal',
      displayIcon: 'reaver.png',
      contentTierUuid: PREMIUM_TIER_UUID,
      levels: [{ uuid: REAVER_LEVEL, displayName: 'Reaver Vandal', streamedVideo: 'reaver.mp4', displayIcon: 'reaver-level.png' }],
      chromas: []
    },
    {
      displayName: 'Oni Phantom',
      displayIcon: 'oni.png',
      contentTierUuid: null,
      levels: [{ uuid: ONI_LEVEL, displayName: 'Oni Phantom', streamedVideo: 'oni.mp4', displayIcon: 'oni-level.png' }],
      chromas: []
    }
  ];
  globalThis.fetch = vi.fn(async (url) => {
    const target = String(url);
    const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (target.includes('/v1/version')) return json({ data: { riotClientVersion: 'release-11.02-shipping-9-3000000' } });
    if (target.includes('/store/v3/storefront/')) {
      return storefrontOk ? json(storefront) : json({}, 500);
    }
    if (target.includes('/account-xp/')) return json({ Progress: { Level: 42 } });
    if (target.includes('/mmr/')) return json({ QueueSkills: {}, LatestCompetitiveUpdate: null });
    if (target.includes('/contenttiers')) {
      return contentOk
        ? json({ data: [{ uuid: PREMIUM_TIER_UUID, rank: 2, displayName: 'Premium Edition', highlightColor: 'd1548d33' }] })
        : json({}, 503);
    }
    // Sisanya: layanan konten (skins). contentOk = false berarti layanan ini mati.
    return contentOk ? json({ data: skins }) : json({}, 503);
  });
}

// Modul akun meng-cache indeks konten dan janji versi client, jadi tiap tes butuh graf modul baru.
async function serviceWith(options) {
  vi.resetModules();
  stubRiot(options);
  return await import('./accountService.js');
}

// Satu akun tersimpan yang sesinya masih berlaku: yang dibutuhkan getDashboard supaya ia benar-benar
// mengambil store, bukan berhenti sebagai 'expired'.
const savedAccount = () => ({
  label: 'main',
  id: 'id-main',
  puuid: PUUID,
  apiSession: { accessToken: 'a.b.c', entitlementsToken: 'ent', puuid: PUUID, shard: 'na', expiresAt: Date.now() + 3_600_000 }
});

function useAccount(account) {
  const store = { listAccounts: [ { label: account.label, id: account.id, puuid: account.puuid } ], saved: account };
  globalThis.__accountStore = store;
  return store;
}

beforeEach(() => {
  vi.doMock('./accountStore.js', () => ({
    captureLiveCredentials: vi.fn(async () => ({ cookie: 'mock' })),
    getActiveAccountId: vi.fn(async () => 'id-main'),
    listAccounts: vi.fn(async () => globalThis.__accountStore?.listAccounts ?? []),
    loadAccount: vi.fn(async () => globalThis.__accountStore?.saved ?? { apiSession: null }),
    saveAccount: vi.fn(async () => ({ id: 'id-main' })),
    updateAccountSession: vi.fn(async () => undefined)
  }));
  vi.doMock('../riot/auth.js', () => ({
    getSessionTokens: vi.fn(async () => ({ puuid: null })),
    resolveShard: vi.fn(async () => 'na')
  }));
});

afterEach(() => { vi.restoreAllMocks(); delete globalThis.__accountStore; });

describe('getDashboard dengan Night Market', () => {
  it('mengirim nightMarket ke renderer, sudah dihias nama, gambar dan tier-nya', async () => {
    useAccount(savedAccount());
    const service = await serviceWith({
      storefront: storefrontWith({
        BonusStore: {
          BonusStoreRemainingDurationInSeconds: MARKET_SECONDS,
          BonusStoreOffers: [
            bonusOffer(REAVER_LEVEL, { cost: 1775, discounted: 1172, percent: 34, seen: false }),
            bonusOffer(ONI_LEVEL, { cost: 875, discounted: 613, percent: 30, seen: true })
          ]
        }
      })
    });

    const { accounts } = await service.getDashboard();
    expect(accounts[0].status).toBe('ready');
    const market = accounts[0].store.nightMarket;

    expect(market).not.toBeNull();
    expect(market.offers).toHaveLength(2);
    expect(market.offers[0]).toMatchObject({
      id: REAVER_LEVEL, name: 'Reaver Vandal', image: 'reaver-level.png',
      price: 1172, originalPrice: 1775, discountPercent: 34, seen: false,
      tier: { color: '#D1548D', label: 'Premium Edition', rank: 2 }
    });
    // Skin tanpa tier Riot tetap tampil, hanya tanpa warna — dan diskonnya tidak ikut hilang.
    expect(market.offers[1]).toMatchObject({ name: 'Oni Phantom', tier: null, discountPercent: 30, seen: true });
  });

  it('mengubah durasi Riot menjadi instant absolut, bukan durasi yang mulai basi saat itu juga', async () => {
    useAccount(savedAccount());
    const service = await serviceWith({
      storefront: storefrontWith({
        BonusStore: {
          BonusStoreRemainingDurationInSeconds: MARKET_SECONDS,
          BonusStoreOffers: [bonusOffer(REAVER_LEVEL, { cost: 1775, discounted: 1172, percent: 34, seen: false })]
        }
      })
    });

    const before = Date.now();
    const { accounts } = await service.getDashboard();
    const after = Date.now();
    const endsAt = accounts[0].store.nightMarket.endsAt;

    // Rentang, bukan nilai persis: yang salah kalau ini gagal adalah bentuknya (durasi dibawa apa
    // adanya), sedangkan selisih beberapa milidetik hanyalah waktu yang dipakai mengambil data.
    expect(endsAt).toBeGreaterThanOrEqual(before + MARKET_SECONDS * 1000);
    expect(endsAt).toBeLessThanOrEqual(after + MARKET_SECONDS * 1000);
  });

  it('nightMarket null ketika Riot tidak sedang mengadakan event, dan akunnya tetap ready', async () => {
    useAccount(savedAccount());
    const service = await serviceWith({ storefront: storefrontWith() });

    const { accounts } = await service.getDashboard();
    expect(accounts[0].status).toBe('ready');
    expect(accounts[0].store.nightMarket).toBeNull();
    // Daily store-nya tidak boleh ikut terpengaruh: ini keadaan sepanjang sebagian besar tahun.
    expect(accounts[0].store.offers).toHaveLength(1);
  });

  it('layanan konten mati: nama hilang dari dua-duanya, tapi angka diskon Night Market bertahan', async () => {
    useAccount(savedAccount());
    const service = await serviceWith({
      contentOk: false,
      storefront: storefrontWith({
        BonusStore: {
          BonusStoreRemainingDurationInSeconds: MARKET_SECONDS,
          BonusStoreOffers: [bonusOffer(REAVER_LEVEL, { cost: 1775, discounted: 1172, percent: 34, seen: false })]
        }
      })
    });

    const { accounts } = await service.getDashboard();
    const store = accounts[0].store;
    // Kegagalan pihak ketiga tidak boleh mengubah akun yang dilayani Riot dengan baik menjadi error.
    expect(accounts[0].status).toBe('ready');
    expect(store.contentUnavailable).toBe(true);
    expect(store.nightMarket.contentUnavailable).toBe(true);
    expect(store.nightMarket.offers[0]).toMatchObject({ name: 'Unknown skin', image: null, discountPercent: 34, price: 1172, originalPrice: 1775 });
  });

  it('storefront yang gagal tetap menggagalkan akunnya seperti sebelumnya', async () => {
    useAccount(savedAccount());
    const service = await serviceWith({ storefront: storefrontWith(), storefrontOk: false });

    const { accounts } = await service.getDashboard();
    expect(accounts[0].status).toBe('error');
    expect(accounts[0].store).toBeUndefined();
  });

  it('tidak ada akun tersimpan: payload kosong, bukan array berisi undefined', async () => {
    globalThis.__accountStore = { listAccounts: [], saved: { apiSession: null } };
    const service = await serviceWith({ storefront: storefrontWith() });

    const { accounts, session } = await service.getDashboard();
    expect(accounts).toEqual([]);
    expect(session.live).toBe(false);
  });
});
