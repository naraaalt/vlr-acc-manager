// Persisted UI preferences (localStorage), one key per domain so features stay
// independent. Same module-store pattern as audioPrefs.js: plain get/set with
// clamped/typed reads, safe against missing storage.

import { SORT_MODES } from './accountOrder.js';

const PREVIEWS_KEY = 'vlr.ui.previewsHidden';
const SORT_KEY = 'vlr.ui.sortMode';

export function getPreviewsHidden() {
  try {
    return localStorage.getItem(PREVIEWS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPreviewsHidden(hidden) {
  try {
    if (hidden) localStorage.setItem(PREVIEWS_KEY, '1');
    else localStorage.removeItem(PREVIEWS_KEY);
  } catch { /* storage unavailable; in-memory only */ }
}

// Sort mode for the account list. 'active' is the default because the
// signed-in account must stay on top across restarts; the others only reorder
// the remaining accounts.
export function getSortMode() {
  try {
    const stored = localStorage.getItem(SORT_KEY);
    return SORT_MODES.includes(stored) ? stored : 'active';
  } catch {
    return 'active';
  }
}

export function setSortMode(mode) {
  try {
    if (!SORT_MODES.includes(mode) || mode === 'active') localStorage.removeItem(SORT_KEY);
    else localStorage.setItem(SORT_KEY, mode);
  } catch { /* storage unavailable; in-memory only */ }
}

// Cycle order for the [O] keybind / sort button. Keeps the persisted value in
// step with the UI, so a mode chosen once survives a restart.
export function nextSortMode(current) {
  const index = SORT_MODES.indexOf(current);
  return SORT_MODES[(index + 1) % SORT_MODES.length];
}
