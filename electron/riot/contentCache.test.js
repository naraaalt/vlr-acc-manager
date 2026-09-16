import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// contentCache memoises the skin index in a module-level promise, so every test
// needs a fresh module graph AND a fresh fetch stub.
const LEVEL_UUID = 'level-uuid-reaver';
const OTHER_LEVEL_UUID = 'level-uuid-oni';

function stubContentApi() {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      data: [
        {
          displayName: 'Reaver Vandal',
          displayIcon: 'reaver.png',
          levels: [{ uuid: LEVEL_UUID, displayName: 'Reaver Vandal', streamedVideo: 'reaver.mp4', displayIcon: 'reaver-level.png' }],
          chromas: []
        },
        {
          displayName: 'Oni Phantom',
          displayIcon: 'oni.png',
          levels: [{ uuid: OTHER_LEVEL_UUID, displayName: 'Oni Phantom', streamedVideo: 'oni.mp4', displayIcon: 'oni-level.png' }],
          chromas: []
        }
      ]
    })
  }));
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
