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

async function getSkinIndex() {
  if (!skinIndexPromise) {
    skinIndexPromise = fetchWithTimeout('https://valorant-api.com/v1/weapons/skins')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not retrieve Valorant skin content (${response.status}).`);
        return response.json();
      })
      .then((payload) => {
        const index = new Map();
        for (const skin of payload.data ?? []) {
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
              category: skin.category ?? null
            });
          }
        }
        return index;
      });
  }
  return skinIndexPromise;
}

export async function resolveDailyOffers(offers) {
  const index = await getSkinIndex();
  return offers.map((offer) => {
    const skin = index.get(offer.offerId);
    return {
      // The renderer keys React lists (and the showcase modal's remount key)
      // on `offer.id`, and the resolved skin record carries no id of its own —
      // without this line every card in the daily store shares one undefined
      // key and the modal stops remounting between skins.
      id: offer.offerId,
      name: skin?.name ?? 'Unknown skin',
      image: skin?.image ?? null,
      video: skin?.video ?? null,
      levels: skin?.levels ?? [],
      chromas: skin?.chromas ?? [],
      category: skin?.category ?? null,
      price: offer.price
    };
  });
}
