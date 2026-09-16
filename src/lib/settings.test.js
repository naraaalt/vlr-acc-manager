import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal localStorage stand-in: jsdom is not configured for this project and the
// module's contract is only "persists, survives absence of storage".
class MemoryStorage {
  #map = new Map();
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(key, String(value)); }
  removeItem(key) { this.#map.delete(key); }
}

// settings.js keeps a module-level subscriber set, so every test gets a fresh module graph.
// Importing it once at the top of this file would share that set across every test.
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

  it('declares exactly nine settings, five of them rendered in the panel', async () => {
    const { SETTINGS } = await loadSettings();
    expect(SETTINGS).toHaveLength(9);
    expect(new Set(SETTINGS.map((setting) => setting.id)).size).toBe(9);
    // The panel shows only what has no other surface; the rest are owned by a keybind or an
    // in-context control. Defaults are covered by the loop test above.
    expect(SETTINGS.filter((setting) => setting.panel !== false)).toHaveLength(5);
  });
});

describe('writing', () => {
  it('round-trips a toggle', async () => {
    const { getSetting, setSetting } = await loadSettings();
    setSetting('notifyOnRotation', false);
    expect(getSetting('notifyOnRotation')).toBe(false);
    setSetting('notifyOnRotation', true);
    expect(getSetting('notifyOnRotation')).toBe(true);
  });

  it('stores everything under one key, including settings the panel does not render', async () => {
    const { setSetting } = await loadSettings();
    setSetting('notifyOnRotation', false);
    setSetting('previewsHidden', true);
    const blob = JSON.parse(globalThis.localStorage.getItem('vlr.settings'));
    expect(blob.notifyOnRotation).toBe(false);
    expect(blob.previewsHidden).toBe(true);
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
    expect(setSetting('notifyOnRotation', false)).toBe(false);
    expect(setSetting('notifyOnRotation', true)).toBe(true);
    expect(getSetting('notifyOnRotation')).toBe(true);
  });

  it('throws on an unknown setting id rather than writing garbage', async () => {
    const { setSetting } = await loadSettings();
    expect(() => setSetting('nope', 1)).toThrow(/Unknown setting/);
  });
});

// The registry is the persistence SCHEMA, not just the panel's row list, so a setting that
// leaves the panel MUST stay in it. If one of these is ever deleted from SETTINGS instead of
// marked panel:false, setSetting throws 'Unknown setting' and the control that owns it stops
// working with nothing on screen to say why.
describe('settings kept out of the panel', () => {
  it('stays writable, so the keybind or overlay that owns it cannot break silently', async () => {
    const { getSetting, setSetting, SETTINGS } = await loadSettings();
    for (const id of ['previewsHidden', 'sortMode', 'showcaseSound', 'showcaseVolume']) {
      expect(SETTINGS.find((setting) => setting.id === id)?.panel).toBe(false);
    }
    expect(setSetting('previewsHidden', true)).toBe(true);
    expect(getSetting('previewsHidden')).toBe(true);
    expect(setSetting('sortMode', 'label')).toBe('label');
    expect(setSetting('showcaseSound', true)).toBe(true);
    expect(setSetting('showcaseVolume', 55)).toBe(55);
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
    setSetting('notifyOnRotation', false);
    resetSettings();
    expect(globalThis.localStorage.getItem('vlr.settings')).toBeNull();
    for (const setting of SETTINGS) expect(getSetting(setting.id)).toEqual(setting.default);
  });

  it('fires immediately and on every change, and stops after unsubscribe', async () => {
    const { setSetting, subscribeSettings } = await loadSettings();
    const seen = [];
    const unsubscribe = subscribeSettings((values) => seen.push(values.notifyOnRotation));
    setSetting('notifyOnRotation', false);
    unsubscribe();
    setSetting('notifyOnRotation', true);
    expect(seen).toEqual([true, false]);
  });

  // This is the contract uiPrefs.js already had, and which its existing tests pin: with
  // storage unavailable a write must not throw, and must not pretend it stuck.
  it('does not throw when storage is unavailable, and does not pretend the write stuck', async () => {
    const { getSetting, setSetting } = await loadSettings();
    globalThis.localStorage = undefined;
    expect(() => setSetting('notifyOnRotation', false)).not.toThrow();
    expect(getSetting('notifyOnRotation')).toBe(true);
    // The return value is the value in effect, not the one that was attempted.
    expect(setSetting('notifyOnRotation', false)).toBe(true);
  });
});

describe('the remembered last account', () => {
  it('is null before anything is written', async () => {
    const { getLastSelection } = await loadSettings();
    expect(getLastSelection()).toBe(null);
  });

  it('round-trips a label without disturbing the settings', async () => {
    const { getLastSelection, setLastSelection, getSetting, setSetting } = await loadSettings();
    setSetting('notifyOnRotation', false);
    setLastSelection('main');
    expect(getLastSelection()).toBe('main');
    expect(getSetting('notifyOnRotation')).toBe(false);
  });

  // Regression: this blob also holds state that is not a setting. Writing a setting used
  // to replace the whole blob and forget which account to reopen, with no error anywhere.
  it('keeps the remembered account when an unrelated setting is written afterwards', async () => {
    const { getLastSelection, setLastSelection, setSetting } = await loadSettings();
    setLastSelection('sec');
    setSetting('notifyOnRotation', false);
    expect(getLastSelection()).toBe('sec');
  });
});