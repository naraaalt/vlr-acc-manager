import { describe, expect, it } from 'vitest';
import { tierRgb } from './tierColor.js';

// Warna tier datang dari Riot sebagai hex, tapi dipakai untuk membangun rgba() — border, glow, dan
// wash semuanya butuh komponennya terpisah supaya satu warna per tier cukup untuk semuanya, tanpa
// menyimpan lima konstanta tambahan yang bisa lupa diperbarui saat Riot menambah tier baru.
describe('tierRgb', () => {
  it('turns a tier hex into the "r, g, b" rgba() needs', () => {
    expect(tierRgb('#D1548D')).toBe('209, 84, 141'); // Premium
    expect(tierRgb('#FAD663')).toBe('250, 214, 99'); // Ultra
  });

  it('accepts the colour without the leading hash, and in lower case', () => {
    expect(tierRgb('d1548d')).toBe('209, 84, 141');
    expect(tierRgb('  #009587  ')).toBe('0, 149, 135'); // Deluxe — dan ia gelap, tapi tetap sah
  });

  it('returns null instead of inventing a colour', () => {
    // Null adalah keadaan yang nyata: 40 dari 1405 skin Riot tidak punya tier, dan layanan tiernya
    // bisa mati. Kartunya harus tetap dirender, hanya tanpa warna.
    expect(tierRgb(null)).toBeNull();
    expect(tierRgb(undefined)).toBeNull();
    expect(tierRgb('')).toBeNull();
    expect(tierRgb('rebeccapurple')).toBeNull();
    expect(tierRgb('#12345')).toBeNull();
    // Delapan digit = bentuk MENTAH dari Riot (RRGGBBAA). Kalau ia sampai ke sini, itu bug di
    // pemanggilnya, dan mengembalikan null lebih baik daripada diam-diam memakai alpha 33.
    expect(tierRgb('#D1548D33')).toBeNull();
  });
});
