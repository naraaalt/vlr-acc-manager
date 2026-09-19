// Kursor daily store di sisi renderer.
//
// Kartu daily store TIDAK clickable: satu-satunya elemen yang bisa diklik di dalamnya adalah tombol
// PREVIEW. Karena itu kursor di sini bukan lagi "kartu yang dipilih user", melainkan "kartu yang
// sedang ditunjuk" — dan penunjuknya ada dua, mouse (hover) dan keyboard ([←][→], [P]). Nilainya
// sengaja boleh `null`: sebelum user menyentuh apa pun tidak ada kartu yang ditunjuk, dan itu
// memang yang diinginkan — kartu nomor satu yang menyala sendiri saat aplikasi baru dibuka terbaca
// sebagai pilihan yang dibuat aplikasi, bukan oleh user.
//
// Dua fungsi di bawah adalah seluruh aturannya, dan keduanya murni: tidak ada state, tidak ada
// clamping tersembunyi di pemanggil, dan tidak ada indeks yang bisa keluar dari rentang daftar.

// Indeks yang benar-benar bisa ditunjuk, atau null kalau tidak ada offer sama sekali. Dipakai juga
// saat daftar menyusut: indeks yang tersimpan bisa jadi menunjuk ke offer yang sudah tidak ada
// (refresh mengembalikan daftar lebih pendek), dan yang terlihat di layar adalah offer terakhir —
// jadi itu yang dipakai, bukan indeks lama.
export function clampOfferCursor(cursor, count) {
  if (!(count > 0)) return null;
  if (cursor === null || cursor === undefined) return null;
  return Math.min(Math.max(cursor, 0), count - 1);
}

// Satu langkah panah. Dari kosong, arah panahnya yang menentukan ujung pendaratan: maju berarti
// kartu pertama, mundur berarti kartu terakhir — kalau keduanya mendarat di kartu yang sama,
// panah pertama setelah membuka aplikasi terasa melompat. Dari kartu yang sudah ditunjuk, langkah
// membungkus di kedua ujung supaya daftar tidak punya jalan buntu.
export function stepOfferCursor(cursor, delta, count) {
  if (!(count > 0)) return null;
  const current = clampOfferCursor(cursor, count);
  if (current === null) return delta > 0 ? 0 : count - 1;
  return (current + delta + count) % count;
}
