import { describe, it, expect, beforeEach } from 'vitest';
import { getPreviewsHidden, setPreviewsHidden } from './uiPrefs.js';

// Minimal localStorage stand-in: jsdom is not configured for this project and
// the module's contract is only "persists, survives absence of storage".
class MemoryStorage {
  #map = new Map();
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(key, String(value)); }
  removeItem(key) { this.#map.delete(key); }
}

describe('uiPrefs previewsHidden', () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });

  it('defaults to false with empty storage', () => {
    expect(getPreviewsHidden()).toBe(false);
  });

  it('round-trips true and back to false', () => {
    setPreviewsHidden(true);
    expect(getPreviewsHidden()).toBe(true);
    setPreviewsHidden(false);
    expect(getPreviewsHidden()).toBe(false);
  });

  it('removes the key entirely when set to false (no "0" residue)', () => {
    setPreviewsHidden(true);
    setPreviewsHidden(false);
    expect(globalThis.localStorage.getItem('vlr.ui.previewsHidden')).toBeNull();
  });

  it('falls back to false when storage is unavailable', () => {
    globalThis.localStorage = undefined;
    expect(() => setPreviewsHidden(true)).not.toThrow();
    expect(getPreviewsHidden()).toBe(false);
  });

  it('reads back a value written by a previous session', () => {
    // Simulates restart: fresh module instance, same storage contents.
    globalThis.localStorage.setItem('vlr.ui.previewsHidden', '1');
    expect(getPreviewsHidden()).toBe(true);
  });
});
