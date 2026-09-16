// Single source of truth for every persisted user preference.
//
// A REGISTRY, not a pile of getters: SettingsPanel renders itself from SETTINGS, so
// adding a preference later is one entry here and zero UI code. Each entry carries its
// own `apply`, which is how a value reaches the app (a data attribute, a module store)
// without the panel knowing anything about it.
//
// One storage key ('vlr.settings'). Preferences that used to live in their own keys are
// migrated once, on first load, so nobody loses a choice they already made. uiPrefs.js
// and audioPrefs.js are thin adapters over this store — they must NOT keep writing their
// own keys, or two writers will drift apart.
//
// STORAGE IS THE ONLY SOURCE OF TRUTH — there is deliberately no in-memory cache.
// A cache drifts the moment anything writes the blob out of band, and it leaks state
// between tests that share one module instance. Reads parse a small JSON object, and the
// call sites are initialisers, effects and event handlers, not render loops.

import { SORT_MODES, SORT_LABELS } from './accountOrder.js';

const KEY = 'vlr.settings';

export const SETTINGS = [
  {
    id: 'density',
    label: 'COMPACT MODE',
    hint: 'Tighter rows and panels — more accounts visible at once, which matters most on a small window.',
    kind: 'toggle',
    default: false,
    // Guarded: this module is imported by the unit tests, where there is no DOM.
    apply: (value) => {
      if (typeof document === 'undefined') return;
      document.documentElement.dataset.density = value ? 'compact' : 'full';
    }
  },
  {
    id: 'previewsHidden',
    label: 'HIDE SKIN PREVIEWS',
    hint: 'Replaces the store cards with a one-line summary. The [H] key still toggles this.',
    kind: 'toggle',
    default: false
  },
  {
    id: 'sortMode',
    label: 'ACCOUNT SORT',
    hint: 'The signed-in account is always first; this orders the rest. The [O] key still cycles it.',
    kind: 'choice',
    default: 'active',
    options: SORT_MODES.map((mode) => ({ value: mode, label: SORT_LABELS[mode] }))
  },
  {
    id: 'showcaseSound',
    label: 'SHOWCASE SOUND',
    hint: 'Play audio in the skin showcase video.',
    kind: 'toggle',
    default: false
  },
  {
    id: 'showcaseVolume',
    label: 'SHOWCASE VOLUME',
    hint: 'Playback volume for the showcase video.',
    kind: 'range',
    default: 70, min: 0, max: 100, step: 5,
    format: (value) => `${value}%`
  },
  {
    id: 'notifyOnRotation',
    label: 'STORE ROTATION NOTICE',
    hint: 'Windows notification when the daily store resets at 00:00 UTC.',
    kind: 'toggle',
    default: true
  },
  {
    id: 'autoSyncOnRotation',
    label: 'AUTO-SYNC ON ROTATION',
    hint: 'Pull every account automatically when the store resets.',
    kind: 'toggle',
    default: true
  },
  {
    id: 'confirmDestructive',
    label: 'CONFIRM SWITCH & DELETE',
    hint: 'Ask before restarting the Riot Client or deleting a saved account.',
    kind: 'toggle',
    default: true
  },
  {
    id: 'restoreLastSelection',
    label: 'REOPEN LAST ACCOUNT',
    hint: 'Select the account you were viewing last, instead of the signed-in one.',
    kind: 'toggle',
    default: false
  },
  {
    id: 'autoCheckUpdates',
    label: 'CHECK UPDATES ON LAUNCH',
    hint: 'One small request to GitHub when the app starts. CHECK NOW in the panel footer works either way.',
    kind: 'toggle',
    // Default ON: fitur ini ada justru supaya tidak perlu ada yang ingat ngecek sendiri.
    default: true
  }
];

const DEFAULTS = Object.fromEntries(SETTINGS.map((setting) => [setting.id, setting.default]));
const listeners = new Set();

function readStorage() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
}

function persist(value) {
  try {
    // Merge over the raw blob rather than replacing it, so store state that is NOT a
    // setting survives every write. The remembered last account lives in this same blob,
    // and a wholesale replace would silently forget it the moment any setting changed.
    localStorage.setItem(KEY, JSON.stringify({ ...(readStorage() ?? {}), ...value }));
    return true;
  } catch {
    // Storage unavailable (blocked, private mode). The write does not stick, and the
    // callers see the defaults — which is the contract uiPrefs.js already had.
    return false;
  }
}

// Read the legacy per-feature keys, once, because 'vlr.settings' was absent. After that
// the new key is the only source, so a legacy key can never override a later choice.
function legacySeed() {
  const seeded = {};
  try {
    const hidden = localStorage.getItem('vlr.ui.previewsHidden');
    if (hidden !== null) seeded.previewsHidden = hidden === '1';
    const sort = localStorage.getItem('vlr.ui.sortMode');
    if (sort !== null) seeded.sortMode = sort;
    const raw = localStorage.getItem('vlr.showcase.audio');
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.soundOn === 'boolean') seeded.showcaseSound = parsed.soundOn;
      if (Number.isFinite(Number(parsed.volume))) seeded.showcaseVolume = Number(parsed.volume);
    }
    // Migration is a MOVE, not a copy. Leaving these behind would resurrect them the first
    // time resetSettings() removes the new key, so a reset would silently undo itself on
    // the next launch. The cost of moving: a rollback to the previous build starts from
    // the defaults.
    localStorage.removeItem('vlr.ui.previewsHidden');
    localStorage.removeItem('vlr.ui.sortMode');
    localStorage.removeItem('vlr.showcase.audio');
  } catch { /* storage unavailable: defaults are fine */ }

  // Persist what was migrated, immediately. The legacy keys are gone and this module has
  // no cache, so if the seeded values were only returned they would be consumed by the
  // import-time read and the very next read would fall back to the defaults.
  const migrated = sanitise(seeded);
  if (Object.keys(migrated).length) persist({ ...DEFAULTS, ...migrated });
  return seeded;
}

// Unknown ids are dropped and every value is coerced to its declared shape, so a
// hand-edited or stale blob can never put a string where a boolean belongs, and a later
// version's setting is dropped rather than trusted.
function sanitise(input) {
  const output = {};
  if (!input || typeof input !== 'object') return output;
  for (const setting of SETTINGS) {
    if (!(setting.id in input)) continue;
    const value = input[setting.id];
    if (setting.kind === 'toggle') { if (typeof value === 'boolean') output[setting.id] = value; continue; }
    if (setting.kind === 'choice') {
      if (setting.options.some((option) => option.value === value)) output[setting.id] = value;
      continue;
    }
    if (setting.kind === 'range') {
      const number = Number(value);
      if (Number.isFinite(number)) output[setting.id] = Math.min(setting.max, Math.max(setting.min, number));
    }
  }
  return output;
}

function read() {
  const stored = readStorage();
  return { ...DEFAULTS, ...sanitise(stored ?? legacySeed()) };
}

function announce() {
  const snapshot = getSettings();
  for (const listener of listeners) listener(snapshot);
}

export function getSetting(id) { return read()[id]; }
export function getSettings() { return { ...read() }; }

// Returns the value now IN EFFECT, which is the default when the write could not be
// persisted — not the value that was attempted.
export function setSetting(id, value) {
  const setting = SETTINGS.find((entry) => entry.id === id);
  if (!setting) throw new Error(`Unknown setting: ${id}`);
  const accepted = sanitise({ [id]: value })[id];
  if (accepted === undefined) return getSetting(id);
  persist({ ...read(), [id]: accepted });
  const effective = getSetting(id);
  setting.apply?.(effective);
  announce();
  return effective;
}

export function resetSettings() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  for (const setting of SETTINGS) setting.apply?.(DEFAULTS[setting.id]);
  announce();
  return getSettings();
}

export function subscribeSettings(listener) {
  listeners.add(listener);
  listener(getSettings());
  return () => listeners.delete(listener);
}

// Not a user-facing setting: remembered so 'reopen last account' has a label to reopen.
// Kept in the same blob so there is still exactly one storage key.
export function getLastSelection() {
  const stored = readStorage();
  return typeof stored?.lastSelectedLabel === 'string' ? stored.lastSelectedLabel : null;
}

export function setLastSelection(label) {
  persist({ lastSelectedLabel: label });
}

// Applied at import time so the app paints at the stored density straight away. A panel
// that only applied on write would flash the full density on every start.
const initial = read();
for (const setting of SETTINGS) setting.apply?.(initial[setting.id]);