import { describe, expect, it } from 'vitest';
import { clampOfferCursor, stepOfferCursor } from './offerCursor.js';

// Kursor daily store adalah indeks kartu yang sedang ditunjuk, dan `null` berarti "belum ada yang
// ditunjuk". `null` itu keadaan awal yang sah, bukan kekurangan: kartu tidak lagi clickable, jadi
// tidak ada alasan satu kartu menyala begitu aplikasi dibuka atau akun berganti.

describe('clampOfferCursor', () => {
  it('keeps a cursor that points inside the list', () => {
    expect(clampOfferCursor(0, 4)).toBe(0);
    expect(clampOfferCursor(3, 4)).toBe(3);
  });

  it('pulls a stale cursor back to the last offer', () => {
    // Refresh bisa mengembalikan daftar yang lebih pendek. Indeks lama tidak boleh menunjuk ke
    // ruang kosong, dan juga tidak boleh dilempar sebagai error.
    expect(clampOfferCursor(9, 4)).toBe(3);
  });

  it('has nothing to point at when there is no offer', () => {
    expect(clampOfferCursor(2, 0)).toBeNull();
    expect(clampOfferCursor(null, 0)).toBeNull();
  });

  it('stays empty while nothing has been pointed at', () => {
    expect(clampOfferCursor(null, 4)).toBeNull();
    expect(clampOfferCursor(undefined, 4)).toBeNull();
  });
});

describe('stepOfferCursor', () => {
  it('enters the list from the end the arrow came from', () => {
    // Panah kanan dari kosong mendarat di kartu pertama, panah kiri di kartu terakhir. Tanpa ini,
    // tombol pertama yang ditekan setelah membuka aplikasi melompat ke ujung yang salah.
    expect(stepOfferCursor(null, 1, 4)).toBe(0);
    expect(stepOfferCursor(null, -1, 4)).toBe(3);
  });

  it('wraps around at both ends', () => {
    expect(stepOfferCursor(3, 1, 4)).toBe(0);
    expect(stepOfferCursor(0, -1, 4)).toBe(3);
  });

  it('moves from the offer actually shown, not from the stale index', () => {
    // 9 sudah tidak ada lagi di daftar empat offer: yang terlihat adalah offer terakhir, jadi
    // langkah berikutnya dihitung dari situ.
    expect(stepOfferCursor(9, 1, 4)).toBe(0);
    expect(stepOfferCursor(9, -1, 4)).toBe(2);
  });

  it('cannot move inside an empty list', () => {
    expect(stepOfferCursor(null, 1, 0)).toBeNull();
    expect(stepOfferCursor(1, 1, 0)).toBeNull();
    expect(stepOfferCursor(1, 1, undefined)).toBeNull();
  });
});
