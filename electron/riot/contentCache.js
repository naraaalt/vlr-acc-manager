let skinIndexPromise;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The Valorant content service took too long to respond. Please try again.', { cause: error });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// The index is built once per session and shared by every account. A FAILED
// attempt must not be remembered: keeping the rejected promise meant one blip
// in the content service made every later account fail instantly without even
// making a request, for the rest of the session. Forget it and let the next
// account try again.
function getSkinIndex() {
  if (!skinIndexPromise) {
    skinIndexPromise = buildSkinIndex().catch((error) => {
      skinIndexPromise = undefined;
      throw error;
    });
  }
  return skinIndexPromise;
}

// Warna tier datang dari Riot sendiri lewat endpoint kedua di layanan konten yang sama — warna
// yang sama dengan yang dipakai game untuk menandai Select sampai Ultra. highlightColor di payload
// itu DELAPAN digit (RRGGBBAA, alpha selalu 33); hanya enam digit pertama yang sebuah warna. Nilai
// mentahnya adalah warna 20% transparan, yang di layar terbaca sebagai "tiernya pudar" alih-alih
// sebagai bug parsing — jadi justru begitulah cara paling mudah mengirimnya ke user tanpa sadar.
function tierFromPayload(tiers, uuid) {
  const tier = tiers.find((entry) => entry.uuid === uuid);
  if (!tier) return null;
  const hex = String(tier.highlightColor ?? '').replace(/^#/, '');
  if (!/^[0-9a-f]{6,8}$/i.test(hex)) return null;
  return { rank: Number(tier.rank) || 0, label: tier.displayName ?? 'Unknown', color: `#${hex.slice(0, 6).toUpperCase()}` };
}

async function buildSkinIndex() {
  const [skinsResponse, tiersResponse] = await Promise.all([
    fetchWithTimeout('https://valorant-api.com/v1/weapons/skins'),
    // Daftar tier itu dekorasi di atas store, bukan store-nya: kegagalannya tidak boleh menggagalkan
    // akun ini. Kartunya hanya kehilangan warna, dan itu keadaan yang sama dengan skin yang memang
    // tidak punya tier.
    fetchWithTimeout('https://valorant-api.com/v1/contenttiers').catch(() => null)
  ]);
  if (!skinsResponse.ok) throw new Error(`Could not retrieve Valorant skin content (${skinsResponse.status}).`);
  const payload = await skinsResponse.json();
  const tiers = tiersResponse?.ok ? (await tiersResponse.json()).data ?? [] : [];

  const index = new Map();
  for (const skin of payload.data ?? []) {
    const tier = tierFromPayload(tiers, skin.contentTierUuid);
    // Per-skin showcase material: one video per upgrade level plus per-
    // variant video/full-render from the chroma endpoint.
    const levels = (skin.levels ?? []).map((level) => ({
      name: level.displayName ?? skin.displayName ?? 'Skin',
      item: level.levelItem ?? null,
      video: level.streamedVideo ?? null,
      icon: level.displayIcon ?? null
    }));
    const chromas = (skin.chromas ?? [])
      .filter((chroma) => chroma.swatch)
      .map((chroma) => ({
        name: (chroma.displayName ?? '').replace(/\s+/g, ' ').trim(),
        swatch: chroma.swatch,
        // Variant-specific showcase: most newer skins have a per-chroma
        // video; every chroma has a full-quality render as fallback.
        video: chroma.streamedVideo ?? null,
        render: chroma.fullRender ?? null
      }));
    for (const level of skin.levels ?? []) {
      index.set(level.uuid, {
        name: level.displayName ?? skin.displayName ?? 'Unknown skin',
        image: level.displayIcon ?? skin.displayIcon ?? null,
        video: level.streamedVideo ?? null,
        levels,
        chromas,
        // valorant-api's /weapons/skins payload carries no category
        // field (verified 2026-09); kept for when it does.
        category: skin.category ?? null,
        tier
      });
    }
  }
  return index;
}

// Satu tempat yang tahu cara mengubah id offer menjadi sebuah skin. Daily store dan Night Market
// menghias offer dengan cara yang sama persis, jadi jalur keduanya wajib memakai ini — dua salinan
// berarti dua tempat yang harus diperbaiki saat layanan konten berubah.
function decorate(index, offer) {
  const skin = index.get(offer.offerId);
  return {
    // Renderer memberi key React (dan key remount modal showcase) pada `offer.id`, sementara record
    // skin tidak membawa id-nya sendiri — tanpa baris ini setiap kartu memakai key undefined yang
    // sama dan modalnya berhenti me-remount antar skin.
    id: offer.offerId,
    name: skin?.name ?? 'Unknown skin',
    image: skin?.image ?? null,
    video: skin?.video ?? null,
    levels: skin?.levels ?? [],
    chromas: skin?.chromas ?? [],
    category: skin?.category ?? null,
    price: offer.price,
    // Null untuk skin yang Riot tidak daftarkan tiernya (40 dari 1405). Kartunya tetap dirender,
    // hanya tanpa warna tier — bukan dibuang dari daftar.
    tier: skin?.tier ?? null
  };
}

export async function resolveDailyOffers(offers) {
  const index = await getSkinIndex();
  return offers.map((offer) => decorate(index, offer));
}

// Id offer dan harganya datang dari Riot; hanya label dekoratifnya (nama, gambar, video showcase)
// yang datang dari layanan konten pihak ketiga. Ini menghasilkan bentuk record yang sama dengan
// label-label itu absen, sehingga kartu, navigasi keyboard dan harganya tetap bekerja sementara
// preview-nya tidak.
function bareOffer(offer) {
  return {
    id: offer.offerId,
    name: 'Unknown skin',
    image: null,
    video: null,
    levels: [],
    chromas: [],
    category: null,
    price: offer.price,
    // Tiernya ikut hilang bersama nama dan gambarnya, karena sumbernya layanan yang sama.
    tier: null
  };
}

export function unavailableDailyOffers(offers) {
  return offers.map(bareOffer);
}

// Discount yang Riot kirim adalah alasan halaman Night Market ada, jadi ia ditempelkan TERAKHIR —
// setelah hiasan, apa pun jalur yang ditempuh. Dengan begitu jalur fallback tidak bisa diam-diam
// menghilangkan angka yang justru jadi konten utamanya.
function withDiscount(resolved, source) {
  return {
    ...resolved,
    originalPrice: source?.originalPrice ?? null,
    discountPercent: source?.discountPercent ?? null,
    seen: Boolean(source?.seen)
  };
}

export async function resolveNightMarketOffers(offers) {
  const index = await getSkinIndex();
  return offers.map((offer) => withDiscount(decorate(index, offer), offer));
}

export async function resolveNightMarketOrFallback(nightMarket) {
  try {
    return { offers: await resolveNightMarketOffers(nightMarket.offers), contentUnavailable: false };
  } catch {
    return { offers: nightMarket.offers.map((offer) => withDiscount(bareOffer(offer), offer)), contentUnavailable: true };
  }
}

export async function resolveDailyOffersOrFallback(offers) {
  try {
    return { offers: await resolveDailyOffers(offers), contentUnavailable: false };
  } catch {
    return { offers: unavailableDailyOffers(offers), contentUnavailable: true };
  }
}
