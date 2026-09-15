// Persisted audio preferences for the skin showcase. Module-level store so the
// volume carries across skins, modal open/close cycles, and app restarts
// (localStorage); the useAudioPrefs hook subscribes React to it.

const KEY = 'vlr.showcase.audio';
const defaults = { soundOn: false, volume: 70 };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      soundOn: typeof raw.soundOn === 'boolean' ? raw.soundOn : defaults.soundOn,
      volume: Number.isFinite(Number(raw.volume)) ? Math.min(100, Math.max(0, Number(raw.volume))) : defaults.volume
    };
  } catch {
    return { ...defaults };
  }
}

let state = load();
const listeners = new Set();

function commit(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable; in-memory only */ }
  for (const listener of listeners) listener(state);
}

export function getAudioPrefs() {
  return state;
}

export function setAudioPrefs(patch) {
  commit({ ...state, ...patch });
}

export function subscribeAudioPrefs(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}
