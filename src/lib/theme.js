// Theme store: single theme (sapphire). Kept as a module so the data-theme
// attribute application lives in one place; previously hosted the VLR legacy
// theme which was removed from the palette.

const KEY = 'vlr.theme';
export const DEFAULT_THEME = 'sapphire';

export function getTheme() {
  return DEFAULT_THEME;
}

// Cleanup: older builds persisted a manual choice here; the VLR theme no
// longer exists, so drop the stale key if it is ever found.
try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }

document.documentElement.dataset.theme = DEFAULT_THEME;
