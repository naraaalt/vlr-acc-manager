let skinIndexPromise;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The Valorant content service took too long to respond. Please try again.');
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
          for (const level of skin.levels ?? []) {
            index.set(level.uuid, {
              name: level.displayName ?? skin.displayName ?? 'Unknown skin',
              image: level.displayIcon ?? skin.displayIcon ?? null
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
      id: offer.offerId,
      name: skin?.name ?? 'Unknown skin',
      image: skin?.image ?? null,
      price: offer.price
    };
  });
}
