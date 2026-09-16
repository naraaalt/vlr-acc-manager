// Parsing + pembanding versi untuk release GitHub. MURNI: nol network, nol Electron, nol fs.
// Semua keputusan — ada versi lebih baru, file mana installernya, digest dipublish atau tidak —
// diuji di unit test, bukan ditemukan di mesin user.
//
// Modul ini SENGAJA tidak import 'electron': vitest jalan di Node biasa.

export const REPO = 'naraaalt/vlr-acc-manager';

// '0.1.10' lebih baru dari '0.1.9'. Perbandingan string kebalikannya, dan pembanding yang salah
// ke arah itu bikin app berhenti nawarin update SELAMANYA begitu versi ke-10 rilis.
export function compareVersions(a, b) {
  const parts = (value) => String(value ?? '').replace(/^v/i, '').trim()
    .split('.')
    .map((piece) => Number.parseInt(piece, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

// electron-builder juga bikin build portable ("Sapphire 0.1.3.exe"). Itu BUKAN yang dijalankan
// untuk update di tempat, jadi filter nama di bawah yang menyingkirkannya.
export function pickInstaller(assets) {
  const list = Array.isArray(assets) ? assets : [];
  return list.find((asset) => /^Sapphire Setup .+\.exe$/i.test(String(asset?.name ?? ''))) ?? null;
}

function base(currentVersion, reason) {
  return {
    available: false,
    currentVersion,
    latestVersion: null,
    reason,
    installer: null,
    notes: null,
    publishedAt: null
  };
}

/**
 * @param {object|null} payload  hasil JSON dari /releases/latest, atau null kalau 404
 * @param {string} currentVersion  app.getVersion()
 * @returns {{ available: boolean, currentVersion: string, latestVersion: string|null,
 *   reason: 'ok'|'up-to-date'|'no-releases'|'prerelease'|'draft'|'no-installer'|'malformed',
 *   installer: { name: string, url: string, size: number|null, digest: string|null }|null,
 *   notes: string|null, publishedAt: string|null }}
 */
export function readRelease(payload, currentVersion) {
  // 404 dari /releases/latest adalah cara GitHub bilang "belum ada yang dipublish". Itu BUKAN
  // error yang perlu ditampilkan — itu justru keadaan repo ini sekarang.
  if (payload == null) return base(currentVersion, 'no-releases');
  if (typeof payload !== 'object' || typeof payload.tag_name !== 'string' || !payload.tag_name.trim()) {
    return base(currentVersion, 'malformed');
  }
  if (payload.draft) return base(currentVersion, 'draft');
  if (payload.prerelease) return base(currentVersion, 'prerelease');

  const latestVersion = payload.tag_name.replace(/^v/i, '').trim();
  const installer = pickInstaller(payload.assets);
  const newer = compareVersions(latestVersion, currentVersion) > 0;

  return {
    available: newer && Boolean(installer),
    currentVersion,
    latestVersion,
    reason: newer ? (installer ? 'ok' : 'no-installer') : 'up-to-date',
    installer: installer ? {
      name: installer.name,
      url: installer.browser_download_url ?? null,
      size: Number.isFinite(installer.size) ? installer.size : null,
      // GitHub mempublish {"digest":"sha256:..."} untuk asset yang diupload sejak pertengahan
      // 2025. Diperlakukan opsional: asset lama bisa null.
      digest: typeof installer.digest === 'string' ? installer.digest : null
    } : null,
    notes: typeof payload.body === 'string' ? payload.body.slice(0, 4000) : null,
    publishedAt: typeof payload.published_at === 'string' ? payload.published_at : null
  };
}