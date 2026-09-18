// Logika Night Market di sisi renderer.
//
// Night Market TIDAK punya jadwal: Riot membukanya kapan saja (~sekali per act, ~2 minggu), dan
// tiap akun mendapat enam offer dengan diskonnya sendiri. Jadi tidak ada yang bisa dihitung dan
// tidak ada tanggal yang boleh ditulis di kode — yang dipakai adalah apa yang Riot kirim.
//
// Karena itu "jendela baru" dikenali dari SIDIK JARI offer-nya, bukan dari tanggal. Setiap jendela
// mendapat BonusOfferID baru, jadi daftar id yang diurutkan mengidentifikasi jendelanya dengan tepat
// — dan dengan begitu "umumkan sekali" jatuh dari datanya sendiri, tanpa perlu menyimpan tanggal
// pengumuman terakhir.

export function nightMarketSignature(nightMarket) {
  const ids = (nightMarket?.offers ?? []).map((offer) => String(offer?.id ?? '')).filter(Boolean).sort();
  return ids.length ? ids.join('|') : null;
}

export function isNewNightMarket(signature, announcedSignature) {
  return Boolean(signature) && signature !== (announcedSignature ?? null);
}

// Sisa detik, atau null kalau Riot tidak mengirim durasi. Pemanggil WAJIB memperlakukan null sebagai
// "terbuka, akhir tidak diketahui" dan bukan sebagai "tidak ada market": offer-nya tetap bisa dibeli.
export function nightMarketCountdown(endsAt, now = Date.now()) {
  if (!Number.isFinite(endsAt)) return null;
  return Math.max(0, Math.floor((endsAt - now) / 1000));
}

export function nightMarketOpen(nightMarket, now = Date.now()) {
  if (!(nightMarket?.offers?.length > 0)) return false;
  const remaining = nightMarketCountdown(nightMarket.endsAt, now);
  return remaining === null || remaining > 0;
}

// Tier tertinggi dulu; di dalam tier yang sama, diskon terbesar dulu. Tier sebelum diskon dengan
// sengaja: yang dicari di layar ini adalah offer terbaik di dalamnya, dan diskon 20% untuk skin
// Ultra lebih bernilai daripada 50% untuk skin Select. Skin yang tidak punya tier dari Riot
// diurutkan paling belakang — ia tetap sebuah offer, bukan kesalahan.
//
// Mengembalikan array BARU: array-nya datang langsung dari payload akun, dan mengurutkannya di tempat
// berarti mengubah state akun itu sendiri.
export function sortNightMarketOffers(offers) {
  return [...(offers ?? [])].sort((a, b) => {
    const rankA = a?.tier?.rank ?? -1;
    const rankB = b?.tier?.rank ?? -1;
    if (rankA !== rankB) return rankB - rankA;
    return (b?.discountPercent ?? -1) - (a?.discountPercent ?? -1);
  });
}
