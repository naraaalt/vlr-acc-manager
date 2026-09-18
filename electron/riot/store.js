const CLIENT_PLATFORM = 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9';
const REQUEST_TIMEOUT_MS = 15_000;
const COMPETITIVE_TIERS = {
  0: 'Unrated',
  3: 'Iron 1', 4: 'Iron 2', 5: 'Iron 3',
  6: 'Bronze 1', 7: 'Bronze 2', 8: 'Bronze 3',
  9: 'Silver 1', 10: 'Silver 2', 11: 'Silver 3',
  12: 'Gold 1', 13: 'Gold 2', 14: 'Gold 3',
  15: 'Platinum 1', 16: 'Platinum 2', 17: 'Platinum 3',
  18: 'Diamond 1', 19: 'Diamond 2', 20: 'Diamond 3',
  21: 'Ascendant 1', 22: 'Ascendant 2', 23: 'Ascendant 3',
  24: 'Immortal 1', 25: 'Immortal 2', 26: 'Immortal 3', 27: 'Radiant'
};

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The Riot service took too long to respond. Please try again.', { cause: error });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// The Riot client version is identical for every account, and Riot rejects a
// request made with a stale one. Fetch it once per session instead of once per
// account — and once per parallel request within an account, which is why five
// accounts used to make ten identical calls to the public version service.
// A failure clears the memo rather than being remembered, so one blip does not
// make every later account fail without even trying.
let clientVersionPromise;
function getClientVersion() {
  if (!clientVersionPromise) {
    clientVersionPromise = (async () => {
      const response = await fetchWithTimeout('https://valorant-api.com/v1/version');
      if (!response.ok) throw new Error(`Could not retrieve the Valorant client version (${response.status}).`);
      const payload = await response.json();
      const version = payload?.data?.riotClientVersion;
      if (!version) throw new Error('The public version service returned no Riot client version.');
      return version;
    })().catch((error) => {
      clientVersionPromise = undefined;
      throw error;
    });
  }
  return clientVersionPromise;
}

async function getAuthenticatedHeaders({ accessToken, entitlementsToken }) {
  const clientVersion = await getClientVersion();
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Riot-Entitlements-JWT': entitlementsToken,
    'X-Riot-ClientPlatform': CLIENT_PLATFORM,
    'X-Riot-ClientVersion': clientVersion,
    'Content-Type': 'application/json'
  };
}

export async function fetchStorefront({ accessToken, entitlementsToken, puuid, shard }) {
  const headers = await getAuthenticatedHeaders({ accessToken, entitlementsToken });

  // Riot migrated this route to a POST-only v3 endpoint. Keep the v2 GET
  // fallback for installations which still expose the older route.
  const v3 = await fetchWithTimeout(`https://pd.${shard}.a.pvp.net/store/v3/storefront/${puuid}`, {
    method: 'POST',
    headers,
    body: '{}'
  });
  if (v3.ok) return v3.json();
  if (![404, 405].includes(v3.status)) {
    throw new Error(`Store request failed (${v3.status}). Update and relaunch Valorant, then try again.`);
  }

  const v2 = await fetchWithTimeout(`https://pd.${shard}.a.pvp.net/store/v2/storefront/${puuid}`, { headers });
  if (v2.ok) return v2.json();
  if (v2.status !== 404) throw new Error(`Store request failed (${v2.status}). Update and relaunch Valorant, then try again.`);
  throw new Error('The Riot Client did not expose a compatible storefront endpoint. Update and relaunch Valorant, then try again.');
}

async function readProfileResponse(response, name) {
  if (!response.ok) throw new Error(`${name} request failed (${response.status}).`);
  return response.json();
}

function extractCompetitiveRank(payload) {
  const competitive = payload?.QueueSkills?.competitive;
  const latest = payload?.LatestCompetitiveUpdate;
  const seasons = Object.values(competitive?.SeasonalInfoBySeasonID ?? {});
  const season = seasons.find((item) => item?.SeasonID === latest?.SeasonID)
    ?? seasons.find((item) => Number(item?.GamesNeededForRating) > 0)
    ?? seasons.find((item) => Number(item?.CompetitiveTier) > 2)
    ?? latest;
  const tier = Number(season?.CompetitiveTier ?? season?.TierAfterUpdate ?? 0);
  const gamesNeeded = Number(season?.GamesNeededForRating ?? 0);
  const rrValue = season?.RankedRating ?? season?.RankedRatingAfterUpdate;
  const rr = Number.isFinite(Number(rrValue)) ? Number(rrValue) : null;

  if (gamesNeeded > 0) return { rank: 'Unranked', rr: null, placementsRemaining: gamesNeeded };
  return { rank: COMPETITIVE_TIERS[tier] ?? 'Unranked', rr: tier > 2 ? rr : null, placementsRemaining: 0 };
}

// These two endpoints are independent of the storefront. A missing profile
// response should never prevent a user from seeing their daily store.
export async function fetchAccountProfile({ accessToken, entitlementsToken, puuid, shard }) {
  const headers = await getAuthenticatedHeaders({ accessToken, entitlementsToken });
  const baseUrl = `https://pd.${shard}.a.pvp.net`;
  const [xpResult, mmrResult] = await Promise.allSettled([
    fetchWithTimeout(`${baseUrl}/account-xp/v1/players/${puuid}`, { headers }).then((response) => readProfileResponse(response, 'Account level')),
    fetchWithTimeout(`${baseUrl}/mmr/v1/players/${puuid}`, { headers }).then((response) => readProfileResponse(response, 'Competitive rank'))
  ]);

  const level = xpResult.status === 'fulfilled' && Number.isFinite(Number(xpResult.value?.Progress?.Level))
    ? Number(xpResult.value.Progress.Level)
    : null;
  const rank = mmrResult.status === 'fulfilled' ? extractCompetitiveRank(mmrResult.value) : null;
  return { level, ...(rank ?? { rank: null, rr: null, placementsRemaining: null }) };
}

// Riot selalu memberi harga satu item, tapi mata uangnya berupa map berkunci id mata uang dan satu
// offer bisa membawa lebih dari satu. Mengambil nilai finite terbesar benar untuk store VP maupun
// night market. null untuk map kosong itu penting: Math.max() dari tidak ada apa-apa adalah
// -Infinity, dan itu akan dirender sebagai harga.
function maxCost(cost) {
  const values = Object.values(cost ?? {}).map(Number).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

export function getDailyOffers(storefront) {
  const layout = storefront?.SkinsPanelLayout;
  const ids = layout?.SingleItemOffers;
  const offers = layout?.SingleItemStoreOffers;
  if (!Array.isArray(ids) || !Array.isArray(offers)) throw new Error('Riot returned a storefront without daily skin offers.');
  return ids.map((id) => {
    const offer = offers.find((item) => item.OfferID === id);
    return { offerId: id, price: maxCost(offer?.Cost) };
  });
}

// Night Market. Riot membukanya per act dan selebihnya field BonusStore cukup tidak ada, jadi tidak
// ada yang perlu diprediksi dan tidak ada jadwal yang perlu disimpan — yang dilaporkan adalah apa
// yang dikatakan storefront. Dua hal di dokumentasi publik salah dan keduanya penting di sini:
// BonusStoreOffers itu array, dan BonusStoreRemainingDurationInSeconds tidak terdaftar sama sekali.
// Keduanya diperlakukan opsional: jendela yang tampil tanpa hitungan lebih baik daripada yang throw.
//
// Offer-nya dikunci pada Rewards[0].ItemID — uuid skin LEVEL — karena itulah namespace yang sudah
// dipakai SkinsPanelLayout.SingleItemOffers, dan karenanya namespace tempat indeks konten dibangun.
// Mengunci pada BonusOfferID akan menghasilkan tanpa nama dan tanpa gambar.
export function getNightMarket(storefront) {
  const raw = storefront?.BonusStore?.BonusStoreOffers;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const offers = raw.map((entry) => {
    const cost = maxCost(entry?.Offer?.Cost);
    const discounted = maxCost(entry?.DiscountCosts);
    const percent = Number(entry?.DiscountPercent);
    return {
      offerId: entry?.Offer?.Rewards?.[0]?.ItemID ?? entry?.Offer?.OfferID ?? null,
      price: discounted ?? cost,
      originalPrice: cost,
      discountPercent: Number.isFinite(percent) ? percent : null,
      seen: Boolean(entry?.IsSeen)
    };
  }).filter((offer) => offer.offerId !== null);
  if (!offers.length) return null;
  const remaining = Number(storefront?.BonusStore?.BonusStoreRemainingDurationInSeconds);
  return { offers, endsInSeconds: Number.isFinite(remaining) ? remaining : null };
}

// Jendelanya, dengan akhir yang sudah jadi instant absolut. `now` adalah parameter supaya aturannya
// bisa diuji tanpa membekukan jam — alasan yang sama dengan nextStoreReset(now) di renderer.
export function nightMarketWindow(storefront, now = Date.now()) {
  const parsed = getNightMarket(storefront);
  if (!parsed) return null;
  return {
    offers: parsed.offers,
    endsAt: parsed.endsInSeconds === null ? null : now + parsed.endsInSeconds * 1000
  };
}
