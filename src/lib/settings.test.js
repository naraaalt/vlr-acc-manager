import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal localStorage stand-in: jsdom is not configured for this project and the
// module's contract is only "persists, survives absence of storage".
class MemoryStorage {
  #map = new Map();
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(key, String(value)); }
  removeItem(key) { this.#map.delete(key); }
}

// settings.js keeps module-level state (a cache and a subscriber set) and applies the
// stored density at import time, so every test needs a fresh module graph. Importing it
// once at the top of this file would give every test the same cache.
async function loadSettings() {
  vi.resetModules();
  return import('./settings.js');
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.document = { documentElement: { dataset: {} } };
});

describe('defaults', () => {
  it('returns every declared default with empty storage', async () => {
    const { SETTINGS, getSetting } = await loadSettings();
    for (const setting of SETTINGS) expect(getSetting(setting.id)).toEqual(setting.default);
  });

  it('declares exactly nine settings, each with a unique id', async () => {
    const { SETTINGS } = await loadSettings();
    expect(SETTINGS).toHaveLength(9);
    expect(new Set(SETTINGS.map((setting) => setting.id)).size).toBe(9);
  });

  it('defaults to the full (non-compact) density', async () => {
    const { getSetting } = await loadSettings();
    expect(getSetting('density')).toBe(false);
  });
});

describe('writing', () => {
  it('round-trips a toggle', async () => {
    const { getSetting, setSetting } = await loadSettings();
    setSetting('density', true);
    expect(getSetting('density')).toBe(true);
    setSetting('density', false);
    expect(getSetting('density')).toBe(false);
  });

  it('stores everything under one key', async () => {
    const { setSetting } = await loadSettings();
    setSetting('density', true);
    const blob = JSON.parse(globalThis.localStorage.getItem('vlr.settings'));
    expect(blob.density).toBe(true);
    expect(globalThis.localStorage.getItem('vlr.ui.previewsHidden')).toBeNull();
  });

  it('rejects a value that is not one of the choices and keeps the current one', async () => {
    const { getSetting, setSetting } = await loadSettings();
    setSetting('sortMode', 'label');
    expect(setSetting('sortMode', 'nonsense')).toBe('label');
    expect(getSetting('sortMode')).toBe('label');
  });

  it('clamps a range value instead of storing it out of bounds', async () => {
    const { getSetting, setSetting } = await loadSettings();
    setSetting('showcaseVolume', 999);
    expect(getSetting('showcaseVolume')).toBe(100);
    setSetting('showcaseVolume', -40);
    expect(getSetting('showcaseVolume')).toBe(0);
  });

  it('accepts the declared default back, so a per-row revert clears the changed flag', async () => {
    const { getSetting, setSetting } = await loadSettings();
    expect(setSetting('density', true)).toBe(true);
    expect(setSetting('density', false)).toBe(false);
    expect(getSetting('density')).toBe(false);
  });

  it('throws on an unknown setting id rather than writing garbage', async () => {
    const { setSetting } = await loadSettings();
    expect(() => setSetting('nope', 1)).toThrow(/Unknown setting/);
  });
});

describe('the apply hook', () => {
  it('sets the density attribute on the document element', async () => {
    const { setSetting } = await loadSettings();
    setSetting('density', true);
    expect(globalThis.document.documentElement.dataset.density).toBe('compact');
    setSetting('density', false);
    expect(globalThis.document.documentElement.dataset.density).toBe('full');
  });

  it('is applied at import time, so a stored density is live before the first paint', async () => {
    globalThis.localStorage.setItem('vlr.settings', JSON.stringify({ density: true }));
    await loadSettings();
    expect(globalThis.document.documentElement.dataset.density).toBe('compact');
  });
});

describe('migration from the old per-feature keys', () => {
  it('adopts a hidden-previews choice made in an earlier version', async () => {
    globalThis.localStorage.setItem('vlr.ui.previewsHidden', '1');
    const { getSetting } = await loadSettings();
    expect(getSetting('previewsHidden')).toBe(true);
  });

  it('adopts a sort mode and an audio preference from an earlier version', async () => {
    globalThis.localStorage.setItem('vlr.ui.sortMode', 'level');
    globalThis.localStorage.setItem('vlr.showcase.audio', JSON.stringify({ soundOn: true, volume: 40 }));
    const { getSetting } = await loadSettings();
    expect(getSetting('sortMode')).toBe('level');
    expect(getSetting('showcaseSound')).toBe(true);
    expect(getSetting('showcaseVolume')).toBe(40);
  });

  it('ignores an unknown legacy sort mode', async () => {
    globalThis.localStorage.setItem('vlr.ui.sortMode', 'nonsense');
    const { getSetting } = await loadSettings();
    expect(getSetting('sortMode')).toBe('active');
  });

  // Regression: migration must not leave the old keys in place. read() falls back to
  // legacySeed() whenever 'vlr.settings' is absent, so a reset that removes the new key
  // would re-adopt the OLD values on the next launch and appear to have done nothing.
  it('clears the legacy keys, so resetting cannot resurrect them', async () => {
    globalThis.localStorage.setItem('vlr.ui.previewsHidden', '1');
    const first = await loadSettings();
    expect(first.getSetting('previewsHidden')).toBe(true);

    first.resetSettings();

    // A fresh module graph over the same storage: this is what a restart looks like.
    const reloaded = await loadSettings();
    expect(reloaded.getSetting('previewsHidden')).toBe(false);
  });
});

describe('reset and subscribe', () => {
  it('clears the key and returns every default', async () => {
    const { SETTINGS, getSetting, setSetting, resetSettings } = await loadSettings();
    setSetting('density', true);
    resetSettings();
    expect(globalThis.localStorage.getItem('vlr.settings')).toBeNull();
    for (const setting of SETTINGS) expect(getSetting(setting.id)).toEqual(setting.default);
  });

  it('fires immediately and on every change, and stops after unsubscribe', async () => {
    const { setSetting, subscribeSettings } = await loadSettings();
    const seen = [];
    const unsubscribe = subscribeSettings((values) => seen.push(values.density));
    setSetting('density', true);
    unsubscribe();
    setSetting('density', false);
    expect(seen).toEqual([false, true]);
  });

  // This is the contract uiPrefs.js already had, and which its existing tests pin: with
  // storage unavailable a write must not throw, and must not pretend it stuck.
  it('does not throw when storage is unavailable, and does not pretend the write stuck', async () => {
    const { getSetting, setSetting } = await loadSettings();
    globalThis.localStorage = undefined;
    expect(() => setSetting('density', true)).not.toThrow();
    expect(getSetting('density')).toBe(false);
    // The return value is the value in effect, not the one that was attempted.
    expect(setSetting('density', true)).toBe(false);
  });
});

describe('the remembered last account', () => {
  it('is null before anything is written', async () => {
    const { getLastSelection } = await loadSettings();
    expect(getLastSelection()).toBe(null);
  });

  it('round-trips a label without disturbing the settings', async () => {
    const { getLastSelection, setLastSelection, getSetting, setSetting } = await loadSettings();
    setSetting('density', true);
    setLastSelection('main');
    expect(getLastSelection()).toBe('main');
    expect(getSetting('density')).toBe(true);
  });

  // Regression: this blob also holds state that is not a setting. Writing a setting used
  // to replace the whole blob and forget which account to reopen, with no error anywhere.
  it('keeps the remembered account when an unrelated setting is written afterwards', async () => {
    const { getLastSelection, setLastSelection, setSetting } = await loadSettings();
    setLastSelection('sec');
    setSetting('density', true);
    expect(getLastSelection()).toBe('sec');
  });
});