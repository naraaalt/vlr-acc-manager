import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cx, parseRank, divisionColor, weaponCategory,
  fmtCountdown, relativeTime, nextStoreReset, storeCountdownSeconds
} from './format.js';

describe('nextStoreReset', () => {
  it('returns the next UTC midnight for a mid-day instant', () => {
    expect(nextStoreReset(Date.UTC(2026, 8, 15, 10, 0, 0)))
      .toBe(Date.UTC(2026, 8, 16, 0, 0, 0));
  });

  it('rolls to the NEXT day when already exactly at UTC midnight', () => {
    // The store has just rotated; the countdown must target tomorrow, not 0.
    expect(nextStoreReset(Date.UTC(2026, 8, 15, 0, 0, 0)))
      .toBe(Date.UTC(2026, 8, 16, 0, 0, 0));
  });

  it('crosses a month boundary', () => {
    expect(nextStoreReset(Date.UTC(2026, 8, 30, 23, 59, 59)))
      .toBe(Date.UTC(2026, 9, 1, 0, 0, 0));
  });

  it('crosses a year boundary', () => {
    expect(nextStoreReset(Date.UTC(2026, 11, 31, 23, 0, 0)))
      .toBe(Date.UTC(2027, 0, 1, 0, 0, 0));
  });

  it('handles February in a leap year', () => {
    expect(nextStoreReset(Date.UTC(2028, 1, 28, 12, 0, 0)))
      .toBe(Date.UTC(2028, 1, 29, 0, 0, 0));
  });

  it('handles February in a non-leap year', () => {
    expect(nextStoreReset(Date.UTC(2026, 1, 28, 12, 0, 0)))
      .toBe(Date.UTC(2026, 2, 1, 0, 0, 0));
  });

  it('is timezone-independent: a WIB evening still targets the next UTC midnight', () => {
    // 2026-09-15T18:00Z is 2026-09-16 01:00 in Jakarta (UTC+7), but the reset
    // instant is fixed to the server clock, not the local calendar day.
    const wibEvening = Date.UTC(2026, 8, 15, 18, 0, 0);
    expect(nextStoreReset(wibEvening)).toBe(Date.UTC(2026, 8, 16, 0, 0, 0));
  });
});

describe('storeCountdownSeconds', () => {
  it('is 86400 one full day out', () => {
    expect(storeCountdownSeconds(Date.UTC(2026, 8, 15, 0, 0, 0))).toBe(86_400);
  });

  it('counts down to 1 second before the rotation', () => {
    expect(storeCountdownSeconds(Date.UTC(2026, 8, 15, 23, 59, 59))).toBe(1);
  });

  it('never goes negative', () => {
    expect(storeCountdownSeconds(Date.UTC(2026, 8, 15, 12, 0, 0))).toBeGreaterThan(0);
  });
});

describe('fmtCountdown', () => {
  it('formats zero', () => {
    expect(fmtCountdown(0)).toBe('00:00:00');
  });

  it('formats hours, minutes and seconds with padding', () => {
    expect(fmtCountdown(3661)).toBe('01:01:01');
  });

  it('formats the largest value in a day', () => {
    expect(fmtCountdown(86_399)).toBe('23:59:59');
  });

  it('clamps negatives to zero rather than rendering a minus sign', () => {
    expect(fmtCountdown(-5)).toBe('00:00:00');
  });

  it('falls back to dashes for non-finite input', () => {
    expect(fmtCountdown(Number.NaN)).toBe('--:--:--');
    expect(fmtCountdown(Infinity)).toBe('--:--:--');
    expect(fmtCountdown(undefined)).toBe('--:--:--');
  });

  it('truncates fractional seconds', () => {
    expect(fmtCountdown(59.9)).toBe('00:00:59');
  });
});

describe('parseRank', () => {
  it('parses a division with a tier number', () => {
    expect(parseRank('Ascendant 2')).toEqual({ division: 'ASCENDANT', tier: 22 });
  });

  it('parses the first tier of a division', () => {
    expect(parseRank('Iron 1')).toEqual({ division: 'IRON', tier: 3 });
  });

  it('parses the last tier of a division', () => {
    expect(parseRank('Diamond 3')).toEqual({ division: 'DIAMOND', tier: 20 });
  });

  it('parses Radiant as the single top tier', () => {
    expect(parseRank('Radiant')).toEqual({ division: 'RADIANT', tier: 27 });
  });

  it('defaults a missing tier to 1', () => {
    expect(parseRank('Gold')).toEqual({ division: 'GOLD', tier: 12 });
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseRank('  immortal 1  ')).toEqual({ division: 'IMMORTAL', tier: 24 });
  });

  it('returns null for Unranked', () => {
    expect(parseRank('Unranked')).toBeNull();
  });

  it('returns null for empty, null and undefined', () => {
    expect(parseRank('')).toBeNull();
    expect(parseRank(null)).toBeNull();
    expect(parseRank(undefined)).toBeNull();
  });
});

describe('divisionColor', () => {
  it('returns the division colour for a valid rank', () => {
    expect(divisionColor('Ascendant 2')).toBe('#1FCE93');
  });

  it('returns the neutral fallback for an unknown rank', () => {
    expect(divisionColor('Unranked')).toBe('#5C6E7E');
  });
});

describe('weaponCategory', () => {
  it('maps rifles', () => {
    expect(weaponCategory('Reaver Vandal')).toBe('RIFLE');
    expect(weaponCategory('Oni Phantom')).toBe('RIFLE');
  });

  it('maps sidearms', () => {
    expect(weaponCategory('Prime Classic')).toBe('SIDEARM');
  });

  it('maps melee skins by their noun', () => {
    expect(weaponCategory('Singularity Blade')).toBe('MELEE');
    expect(weaponCategory('Prime Axe')).toBe('MELEE');
  });

  it('is case-insensitive', () => {
    expect(weaponCategory('reaver vandal')).toBe('RIFLE');
  });

  it('falls back to the last word when nothing matches', () => {
    expect(weaponCategory('Kuronami no Yaiba')).toBe('YAIBA');
  });

  it('falls back to WEAPON for empty input', () => {
    expect(weaponCategory('')).toBe('WEAPON');
    expect(weaponCategory(null)).toBe('WEAPON');
    expect(weaponCategory(undefined)).toBe('WEAPON');
    expect(weaponCategory('   ')).toBe('WEAPON');
  });

  it('ignores leading and trailing whitespace instead of returning an empty label', () => {
    expect(weaponCategory('  Kuronami no Yaiba ')).toBe('YAIBA');
    expect(weaponCategory('Reaver Vandal ')).toBe('RIFLE');
  });
});

describe('relativeTime', () => {
  const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders just now under a minute', () => {
    expect(relativeTime(NOW - 30_000)).toBe('just now');
  });

  it('renders minutes', () => {
    expect(relativeTime(NOW - 4 * 60_000)).toBe('4 min ago');
  });

  it('renders hours', () => {
    expect(relativeTime(NOW - 3 * 3_600_000)).toBe('3 h ago');
  });

  it('renders days', () => {
    expect(relativeTime(NOW - 2 * 86_400_000)).toBe('2 d ago');
  });

  it('treats a future timestamp as just now instead of a negative age', () => {
    expect(relativeTime(NOW + 60_000)).toBe('just now');
  });

  it('renders an em dash for missing or invalid input', () => {
    expect(relativeTime(null)).toBe('—');
    expect(relativeTime('not a date')).toBe('—');
  });
});

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('acct', false, 'sel', null, undefined, '')).toBe('acct sel');
  });
});
