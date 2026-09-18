import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// contentCache memoises the skin index in a module-level promise, so every test
// needs a fresh module graph AND a fresh fetch stub.
const LEVEL_UUID = 'level-uuid-reaver';
const OTHER_LEVEL_UUID = 'level-uuid-oni';
// Tier adalah warna skin, dan warnanya datang dari Riot lewat endpoint kedua. Nilai di bawah ini
// disalin apa adanya dari respons sungguhan: highlightColor DELAPAN digit, RRGGBBAA dengan alpha 33.
const PREMIUM_TIER_UUID = 'tier-premium';

// Fetch stub yang merutekan per URL, bukan satu respons untuk semuanya: sejak tier ditambahkan,
// dua permintaan berbeda terjadi (skins dan contenttiers), dan stub yang menjawab keduanya dengan
// payload yang sama akan menyembunyikan kesalahan parsing yang justru mau diuji.
function stubContentApi({ tiersOk = true } = {}) {
  const skins = [
    {
      displayName: 'Reaver Vandal',
      displayIcon: 'reaver.png',
      contentTierUuid: PREMIUM_TIER_UUID,
      levels: [{ uuid: LEVEL_UUID, displayName: 'Reaver Vandal', streamedVideo: 'reaver.mp4', displayIcon: 'reaver-level.png' }],
      chromas: []
    },
    {
      displayName: 'Oni Phantom',
      displayIcon: 'oni.png',
      // Tanpa tier: 40 dari 1405 skin Riot memang begini. Skin-nya tetap harus tampil.
      contentTierUuid: null,
      levels: [{ uuid: OTHER_LEVEL_UUID, displayName: 'Oni Phantom', streamedVideo: 'oni.mp4', displayIcon: 'oni-level.png' }],
      chromas: []
    }
  ];
  const tiers = [
    { uuid: PREMIUM_TIER_UUID, rank: 2, displayName: 'Premium Edition', highlightColor: 'd1548d33' },
    { uuid: 'tier-ultra', rank: 4, displayName: 'Ultra Edition', highlightColor: 'fad66333' }
  ];
  globalThis.fetch = vi.fn(async (url) => {
    const target = String(url);
    if (target.includes('/contenttiers')) {
      return tiersOk
        ? { ok: true, status: 200, json: async () => ({ data: tiers }) }
        : { ok: false, status: 503, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({ data: skins }) };
  });
}

async function loadResolver() {
  vi.resetModules();
  stubContentApi();
  const module = await import('./contentCache.js');
  return module.resolveDailyOffers;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('resolveDailyOffers', () => {
  beforeEach(() => { stubContentApi(); });

  it('forwards the offerId as `id`, which the renderer uses as its React key', async () => {
    const resolveDailyOffers = await loadResolver();
    const [offer] = await resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    expect(offer.id).toBe(LEVEL_UUID);
  });

  it('keeps every offer id distinct so list keys never collide', async () => {
    const resolveDailyOffers = await loadResolver();
    const offers = await resolveDailyOffers([
      { offerId: LEVEL_UUID, price: 1775 },
      { offerId: OTHER_LEVEL_UUID, price: 2175 }
    ]);
    expect(offers.map((offer) => offer.id)).toEqual([LEVEL_UUID, OTHER_LEVEL_UUID]);
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(2);
  });

  it('keeps the id even when the skin is unknown, so the key is never undefined', async () => {
    const resolveDailyOffers = await loadResolver();
    const [offer] = await resolveDailyOffers([{ offerId: 'not-in-content-index', price: 875 }]);
    expect(offer.id).toBe('not-in-content-index');
    expect(offer.name).toBe('Unknown skin');
  });

  it('resolves the skin payload and preserves the price', async () => {
    const resolveDailyOffers = await loadResolver();
    const [offer] = await resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    expect(offer).toMatchObject({
      name: 'Reaver Vandal',
      image: 'reaver-level.png',
      video: 'reaver.mp4',
      price: 1775
    });
  });

  it('returns an empty list for an empty store without fetching', async () => {
    const resolveDailyOffers = await loadResolver();
    expect(await resolveDailyOffers([])).toEqual([]);
  });
});

// One blip in the content service must not break every account for the rest of
// the session. The rejected promise used to be remembered, so each later
// account failed instantly without even making a request.
describe('a failed content fetch is not remembered', () => {
  it('retries on the next account and succeeds once the service is back', async () => {
    const resolveDailyOffers = await loadResolver();

    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    await expect(resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }])).rejects.toThrow(/skin content/i);

    // Service recovers.
    stubContentApi();
    const calls = globalThis.fetch.mock.calls.length;
    const [offer] = await resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    expect(globalThis.fetch.mock.calls.length).toBeGreaterThan(calls);
    expect(offer.name).toBe('Reaver Vandal');
  });

  it('does not re-fetch while the cached index is still valid', async () => {
    const resolveDailyOffers = await loadResolver();
    await resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    const callsAfterFirst = globalThis.fetch.mock.calls.length;
    await resolveDailyOffers([{ offerId: OTHER_LEVEL_UUID, price: 2175 }]);
    expect(globalThis.fetch.mock.calls.length).toBe(callsAfterFirst);
  });
});

// Skin names and previews are decorative, and they come from a third-party
// service rather than from Riot. Losing them must not hide a store Riot served.
describe('resolveDailyOffersOrFallback', () => {
  it('keeps the store usable, with prices, when the content service is down', async () => {
    vi.resetModules();
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const { resolveDailyOffersOrFallback } = await import('./contentCache.js');

    const result = await resolveDailyOffersOrFallback([
      { offerId: LEVEL_UUID, price: 1775 },
      { offerId: OTHER_LEVEL_UUID, price: 2175 }
    ]);

    expect(result.contentUnavailable).toBe(true);
    // Riot's own data survives: the ids (React keys) and the prices.
    expect(result.offers.map((offer) => offer.id)).toEqual([LEVEL_UUID, OTHER_LEVEL_UUID]);
    expect(result.offers.map((offer) => offer.price)).toEqual([1775, 2175]);
    expect(result.offers.every((offer) => offer.name === 'Unknown skin')).toBe(true);
    expect(result.offers.every((offer) => offer.image === null && offer.video === null)).toBe(true);
  });

  it('flags nothing and names every skin when the content service works', async () => {
    vi.resetModules();
    stubContentApi();
    const { resolveDailyOffersOrFallback } = await import('./contentCache.js');

    const result = await resolveDailyOffersOrFallback([{ offerId: LEVEL_UUID, price: 1775 }]);

    expect(result.contentUnavailable).toBe(false);
    expect(result.offers[0].name).toBe('Reaver Vandal');
  });

  it('gives the fallback records the same shape as resolved ones', async () => {
    const resolveDailyOffers = await loadResolver();
    const [resolved] = await resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    const { unavailableDailyOffers } = await import('./contentCache.js');
    const [fallback] = unavailableDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    expect(Object.keys(fallback).sort()).toEqual(Object.keys(resolved).sort());
  });
});

// Tier adalah warna skin itu sendiri — warna yang sama yang dipakai game untuk menandai
// Select/Deluxe/Premium/Exclusive/Ultra. Sumbernya endpoint KEDUA dari layanan konten yang sama.
describe('skin tier', () => {
  it('attaches rank, label and colour to a resolved offer', async () => {
    const resolveDailyOffers = await loadResolver();
    const [offer] = await resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    expect(offer.tier).toEqual({ rank: 2, label: 'Premium Edition', color: '#D1548D' });
  });

  it('takes SIX hex digits out of the eight Riot sends', async () => {
    // highlightColor = RRGGBBAA dengan alpha 33. Menyerahkan 'd1548d33' langsung ke CSS menghasilkan
    // warna 20% transparan — dan itu terbaca sebagai "tiernya pudar", bukan sebagai bug parsing,
    // jadi justru begitu cara paling mudah untuk tanpa sengaja mengirimnya ke user.
    const resolveDailyOffers = await loadResolver();
    const [offer] = await resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    expect(offer.tier.color).toBe('#D1548D');
    expect(offer.tier.color).toHaveLength(7);
    expect(offer.tier.color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('keeps an offer whose skin Riot lists no tier for, with a null tier', async () => {
    // 40 dari 1405 skin tidak punya contentTierUuid. Skin tanpa tier tetap barang yang bisa dibeli.
    const resolveDailyOffers = await loadResolver();
    const [offer] = await resolveDailyOffers([{ offerId: OTHER_LEVEL_UUID, price: 2175 }]);
    expect(offer.name).toBe('Oni Phantom');
    expect(offer.tier).toBeNull();
  });

  it('survives a failed tier fetch: names still resolve, tier is null', async () => {
    // Daftar tier itu dekorasi di atas store. Kalau layanannya mati, store-nya harus tetap tampil —
    // kartunya hanya kehilangan warnanya, bukan hilang.
    vi.resetModules();
    stubContentApi({ tiersOk: false });
    const { resolveDailyOffers } = await import('./contentCache.js');
    const [offer] = await resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    expect(offer.name).toBe('Reaver Vandal');
    expect(offer.tier).toBeNull();
  });

  it('reads the tier list once per session, not once per account', async () => {
    const resolveDailyOffers = await loadResolver();
    await resolveDailyOffers([{ offerId: LEVEL_UUID, price: 1775 }]);
    const tierCalls = () => globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/contenttiers')).length;
    expect(tierCalls()).toBe(1);
    await resolveDailyOffers([{ offerId: OTHER_LEVEL_UUID, price: 2175 }]);
    expect(tierCalls()).toBe(1);
  });
});
