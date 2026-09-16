import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { REPO, readRelease } from './release.js';

// Modul ini juga SENGAJA tidak import 'electron'. Yang butuh app.getPath('temp') mengirim
// `root` sebagai parameter — jadi seluruh alurnya bisa diuji di Node biasa.

const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const CHECK_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;
const USER_AGENT = 'Sapphire-update-check';

// Satu sesi = satu request, kecuali user mencet CHECK NOW (force). Cek update adalah request
// pihak ketiga baru di app yang sengaja menekan jumlahnya, jadi jangan diulang tiap render.
let cached = null;

export function digestExpectation(digest) {
  if (typeof digest !== 'string') return null;
  const match = /^sha256:([0-9a-f]{64})$/i.exec(digest.trim());
  return match ? match[1].toLowerCase() : null;
}

export function digestMatches(digest, hex) {
  const expected = digestExpectation(digest);
  if (!expected || typeof hex !== 'string') return false;
  return expected === hex.toLowerCase();
}

// Tidak diekspor: cuma dipakai installerPath() di file ini, dan js:dead benar menyebutnya
// sebagai surface mati selama ia diekspor.
function updateRoot(scratchRoot) {
  return path.join(scratchRoot, 'sapphire-update');
}

export function installerPath(scratchRoot, info) {
  // Nama file datang DARI payload GitHub, jadi ia tidak boleh dipercaya sebagai path.
  // basename() memastikan ia tidak bisa keluar dari folder temp.
  return path.join(updateRoot(scratchRoot), path.basename(String(info?.installer?.name ?? 'update.exe')));
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: 'application/vnd.github+json', 'user-agent': USER_AGENT }
    });
    // 404 = belum ada release. Ini bukan kegagalan; readRelease yang memutuskan artinya.
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub answered ${response.status}.`);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The update check took too long. Try again.', { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdates({ currentVersion, fetchImpl = fetch, force = false }) {
  if (cached && !force) return cached;
  const payload = await fetchJson(API, fetchImpl, CHECK_TIMEOUT_MS);
  const result = readRelease(payload, currentVersion);
  cached = { ...result, checkedAt: Date.now() };
  return cached;
}

// Dipakai tes supaya cache satu-sesi tidak bocor antar kasus.
export function forgetUpdate() { cached = null; }

export async function downloadInstaller(info, { root, onProgress, fetchImpl = fetch } = {}) {
  const directory = updateRoot(root);
  await mkdir(directory, { recursive: true });
  const target = installerPath(root, info);
  await rm(target, { force: true });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  const hash = createHash('sha256');
  let received = 0;

  try {
    const response = await fetchImpl(info.installer.url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`The download failed (${response.status}).`);
    const total = Number(response.headers?.get?.('content-length')) || info.installer.size || 0;

    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk);
        received += chunk.length;
        if (onProgress) onProgress({ received, total });
        callback(null, chunk);
      }
    });

    await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(target));
  } catch (error) {
    clearTimeout(timer);
    await rm(target, { force: true });
    if (error.name === 'AbortError') throw new Error('The download took too long and was cancelled.', { cause: error });
    throw error;
  }
  clearTimeout(timer);

  const sha256 = hash.digest('hex');
  // Digest adalah INTEGRITAS, bukan keaslian: siapa pun yang bisa mengganti asset release juga
  // bisa mengganti digest-nya. Ini menangkap unduhan yang rusak/terpotong, dan itu tujuannya.
  if (!digestMatches(info.installer.digest, sha256)) {
    await rm(target, { force: true });
    throw new Error('The downloaded installer does not match the checksum published with the release.');
  }
  return { path: target, bytes: received, sha256 };
}