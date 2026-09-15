// Persisted UI preferences (localStorage), one key per domain so features stay
// independent. Same module-store pattern as audioPrefs.js: plain get/set with
// clamped/typed reads, safe against missing storage.

const KEY = 'vlr.ui.previewsHidden';

export function getPreviewsHidden() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setPreviewsHidden(hidden) {
  try {
    if (hidden) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable; in-memory only */ }
}
