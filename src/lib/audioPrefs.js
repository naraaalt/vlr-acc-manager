// Adapter over the single settings store (src/lib/settings.js). The showcase reads a
// {soundOn, volume} pair as one object; the store holds them as two independent settings.
//
// Note: subscribeAudioPrefs now fires whenever ANY setting changes, because it subscribes
// to the store rather than to the audio pair. The listener is a setState, so an unrelated
// change costs one extra render and nothing else.

import { getSetting, setSetting, subscribeSettings } from './settings.js';

export function getAudioPrefs() {
  return { soundOn: Boolean(getSetting('showcaseSound')), volume: getSetting('showcaseVolume') };
}

export function setAudioPrefs(patch) {
  if ('soundOn' in patch) setSetting('showcaseSound', Boolean(patch.soundOn));
  if ('volume' in patch) setSetting('showcaseVolume', Number(patch.volume));
}

export function subscribeAudioPrefs(listener) {
  return subscribeSettings(() => listener(getAudioPrefs()));
}