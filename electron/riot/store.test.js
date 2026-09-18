import { afterEach, describe, expect, it, vi } from 'vitest';

// The Riot client version is one value shared by every account, but it used to
// be fetched per request: fetchStorefront and fetchAccountProfile each pulled it
// in parallel, so five accounts made ten identical calls to the public version
// service. These tests pin the memo AND the fact that a failure is not
// remembered (a cached rejection would break every later account).
const SESSION = { accessToken: 'access.token.sig', entitlementsToken: 'ent', puuid: 'puuid-1', shard: 'ap' };

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function stubNetwork({ versionStatus = 200 } = {}) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url) => {
    const target = String(url);
    calls.push(target);
    if (target.includes('/v1/version')) {
      return versionStatus === 200
        ? jsonResponse({ data: { riotClientVersion: 'release-11.0-test' } })
        : jsonResponse({}, versionStatus);
    }
    if (target.includes('/storefront/')) {
      return jsonResponse({
        SkinsPanelLayout: {
          SingleItemOffers: ['skin-a'],
          SingleItemStoreOffers: [{ OfferID: 'skin-a', Cost: { valorantPoints: 1775 } }],
          SingleItemOffersRemainingDurationInSeconds: 3600
        }
      });
    }
    if (target.includes('/account-xp/')) return jsonResponse({ Progress: { Level: 121 } });
    if (target.includes('/mmr/')) return jsonResponse({ QueueSkills: {} });
    return jsonResponse({});
  });
  return calls;
}

// clientVersionPromise is module state, so every test needs a fresh graph.
async function loadStore() {
  vi.resetModules();
  return import('./store.js');
}

const versionCalls = (calls) => calls.filter((url) => url.includes('valorant-api.com/v1/version')).length;

afterEach(() => { vi.restoreAllMocks(); });

describe('client version memo', () => {
  it('fetches the version once for a whole account load', async () => {
    const calls = stubNetwork();
    const store = await loadStore();

    // This is exactly how accountService loads one account: in parallel.
    await Promise.all([store.fetchStorefront(SESSION), store.fetchAccountProfile(SESSION)]);

    expect(versionCalls(calls)).toBe(1);
  });

  it('fetches the version once for five accounts instead of ten times', async () => {
    const calls = stubNetwork();
    const store = await loadStore();

    for (let index = 0; index < 5; index += 1) {
      await Promise.all([store.fetchStorefront(SESSION), store.fetchAccountProfile(SESSION)]);
    }

    expect(versionCalls(calls)).toBe(1);
    // 5 storefronts + 5 xp + 5 mmr + the single version call.
    expect(calls.length).toBe(16);
  });

  it('stamps the resolved version onto the Riot request', async () => {
    stubNetwork();
    const store = await loadStore();
    let sentVersion = null;
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url, options) => {
      if (String(url).includes('/storefront/')) sentVersion = options?.headers?.['X-Riot-ClientVersion'] ?? null;
      return realFetch(url, options);
    });

    await store.fetchStorefront(SESSION);

    expect(sentVersion).toBe('release-11.0-test');
  });

  it('does not remember a failed version fetch, so the next account retries', async () => {
    const failing = stubNetwork({ versionStatus: 503 });
    const store = await loadStore();
    await expect(store.fetchStorefront(SESSION)).rejects.toThrow(/client version/i);
    expect(versionCalls(failing)).toBe(1);

    const recovered = stubNetwork();
    const storefront = await store.fetchStorefront(SESSION);
    expect(versionCalls(recovered)).toBe(1);
    expect(storefront.SkinsPanelLayout.SingleItemOffers).toEqual(['skin-a']);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const calls = stubNetwork();
    const store = await loadStore();

    await Promise.all([
      store.fetchStorefront(SESSION),
      store.fetchAccountProfile(SESSION),
      store.fetchStorefront(SESSION),
      store.fetchAccountProfile(SESSION)
    ]);

    expect(versionCalls(calls)).toBe(1);
  });
});


// ── Night Market ────────────────────────────────────────────────────────────────
// Riot membuka Night Market per act dan selebihnya cukup MENGHILANGKAN field BonusStore, jadi tidak
// ada yang bisa diprediksi dan tidak ada jadwal yang perlu disimpan. Tes di bawah mengunci parsing
// field yang Riot MEMANG kirim, termasuk dua yang salah di dokumentasi publik: BonusStoreOffers itu
// array (generator dokumennya membuang []-nya), dan BonusStoreRemainingDurationInSeconds tidak
// terdaftar sama sekali padahal ada di respons sungguhan.
const BONUS_STORE = {
  BonusStoreOffers: [
    {
      BonusOfferID: 'bonus-1',
      Offer: {
        OfferID: 'offer-1', IsDirectPurchase: false, StartDate: '2026-09-18T00:00:00Z',
        Cost: { valorantPoints: 1775 }, Rewards: [{ ItemTypeID: 'type', ItemID: 'level-1', Quantity: 1 }]
      },
      DiscountPercent: 34,
      DiscountCosts: { valorantPoints: 1172 },
      IsSeen: false
    },
    {
      BonusOfferID: 'bonus-2',
      Offer: { Cost: { valorantPoints: 2675 }, Rewards: [{ ItemTypeID: 'type', ItemID: 'level-2', Quantity: 1 }] },
      DiscountPercent: 12,
      DiscountCosts: { valorantPoints: 2354 },
      IsSeen: true
    }
  ],
  BonusStoreRemainingDurationInSeconds: 1209600
};

describe('getNightMarket', () => {
  it('reads the discount, both prices, the seen flag and the skin level id', async () => {
    const { getNightMarket } = await loadStore();
    expect(getNightMarket({ BonusStore: BONUS_STORE })).toEqual({
      offers: [
        { offerId: 'level-1', price: 1172, originalPrice: 1775, discountPercent: 34, seen: false },
        { offerId: 'level-2', price: 2354, originalPrice: 2675, discountPercent: 12, seen: true }
      ],
      endsInSeconds: 1209600
    });
  });

  it('keys on the skin LEVEL id, which is the namespace the content index is built on', async () => {
    // Keying on BonusOfferID instead would resolve no names and no images, and the failure would
    // look like a content-service outage rather than a wrong key.
    const { getNightMarket } = await loadStore();
    expect(getNightMarket({ BonusStore: BONUS_STORE }).offers.map((offer) => offer.offerId))
      .toEqual(['level-1', 'level-2']);
  });

  it('returns null when Riot sends no BonusStore at all', async () => {
    // The normal case for most of the year: the key is simply absent.
    const { getNightMarket } = await loadStore();
    expect(getNightMarket({ SkinsPanelLayout: {} })).toBeNull();
    expect(getNightMarket({ BonusStore: null })).toBeNull();
    expect(getNightMarket(undefined)).toBeNull();
  });

  it('returns null for an empty BonusStore rather than rendering an empty market', async () => {
    const { getNightMarket } = await loadStore();
    expect(getNightMarket({ BonusStore: { BonusStoreOffers: [], BonusStoreRemainingDurationInSeconds: 60 } })).toBeNull();
  });

  it('falls back to the full price when no discounted cost was sent', async () => {
    const { getNightMarket } = await loadStore();
    const market = getNightMarket({ BonusStore: { BonusStoreOffers: [
      { Offer: { Cost: { valorantPoints: 875 }, Rewards: [{ ItemID: 'level-3' }] }, DiscountPercent: 20, IsSeen: false }
    ] } });
    expect(market.offers[0]).toEqual({ offerId: 'level-3', price: 875, originalPrice: 875, discountPercent: 20, seen: false });
  });

  it('reports a missing duration as null instead of NaN', async () => {
    // NaN would reach the countdown and print '--:--:--' forever; null means "open, end unknown",
    // and the offers are still buyable, so the page must still render them.
    const { getNightMarket } = await loadStore();
    const market = getNightMarket({ BonusStore: { BonusStoreOffers: [
      { Offer: { Cost: { vp: 100 }, Rewards: [{ ItemID: 'level-4' }] } }
    ] } });
    expect(market.endsInSeconds).toBeNull();
    expect(market.offers[0].discountPercent).toBeNull();
    expect(market.offers[0].seen).toBe(false);
  });

  it('drops an offer with no identifiable skin and keeps the rest', async () => {
    const { getNightMarket } = await loadStore();
    const market = getNightMarket({ BonusStore: { BonusStoreOffers: [
      { Offer: { Cost: { vp: 1 } } },
      { Offer: { Cost: { vp: 2 }, Rewards: [{ ItemID: 'level-5' }] } }
    ] } });
    expect(market.offers.map((offer) => offer.offerId)).toEqual(['level-5']);
  });
});

describe('nightMarketWindow', () => {
  it('turns the remaining duration into an absolute instant', async () => {
    // Riot sends a duration measured AT THIS REQUEST. Stored or passed around, it starts being wrong
    // the moment it is measured — an account synced three days ago would restart its countdown at 14
    // days. The daily store avoids the same trap by counting to a fixed instant; this does the same.
    const { nightMarketWindow } = await loadStore();
    const opened = nightMarketWindow({ BonusStore: BONUS_STORE }, 1_000_000);
    expect(opened.endsAt).toBe(1_000_000 + 1_209_600_000);
    expect(opened.offers).toHaveLength(2);
  });

  it('is null when there is no market, and has no end when Riot sent no duration', async () => {
    const { nightMarketWindow } = await loadStore();
    expect(nightMarketWindow({ SkinsPanelLayout: {} }, 1_000_000)).toBeNull();
    const open = nightMarketWindow({ BonusStore: { BonusStoreOffers: [
      { Offer: { Cost: { vp: 1 }, Rewards: [{ ItemID: 'l' }] } }
    ] } }, 1_000_000);
    expect(open.endsAt).toBeNull();
  });
});
