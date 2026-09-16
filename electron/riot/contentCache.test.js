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
