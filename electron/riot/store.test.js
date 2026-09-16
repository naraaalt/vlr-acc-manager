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
