// Tier warna skin, untuk dipakai renderer.
//
// Warna itu datang dari Riot sebagai hex, tetapi hampir semuanya di layar dipakai sebagai rgba():
// border, glow, dan wash semuanya versi tembus pandang dari warna yang SAMA. Menyimpan satu hex per
// tier lalu menurunkannya di sini lebih baik daripada mengirim lima string rgba siap pakai dari main
// process — jumlah yang harus dijaga tetap satu per tier.
export function tierRgb(color) {
  const hex = String(color ?? '').trim().replace(/^#/, '');
  // Sengaja HANYA enam digit. Delapan digit adalah bentuk mentah dari Riot (RRGGBBAA, alpha 33),
  // dan menerimanya di sini berarti diam-diam melukis warna 20% transparan — yang di layar terbaca
  // sebagai tier yang pudar, bukan sebagai kesalahan. Null membuatnya terlihat.
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const byte = (offset) => parseInt(hex.slice(offset, offset + 2), 16);
  return `${byte(0)}, ${byte(2)}, ${byte(4)}`;
}
