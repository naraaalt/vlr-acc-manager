// Membuang sampah yang ditinggalkan proses update.
//
// Kenapa modul ini ada: satu update Sapphire meninggalkan DUA jejak yang tidak pernah diambil
// siapa pun. Installer NSIS memindahkan Sapphire.exe yang lama ke `%TEMP%\nsXXXX.tmp\old-install\`
// supaya bisa menimpa exe yang sedang berjalan, lalu direktori itu ditinggal — 225 MB per install,
// terukur 1,3 GB setelah enam update. Dan installer yang sudah diunduh (100 MB per versi) tidak
// pernah dihapus setelah dipakai. Pola sweep-nya sudah ada di repo ini (`sweepStaleTempFiles` di
// accountStore.js); modul ini memakai gagasan yang sama untuk dua lokasi yang lain.
//
// BAGIAN YANG BERISIKO BUKAN MENGHAPUS, TAPI MENGHAPUS TERLALU BANYAK. Karena itu setiap keputusan
// ada di fungsi murni yang bisa diuji, dan runner-nya sengaja best-effort: file yang gagal dihapus
// akan dicoba lagi launch berikutnya, sementara app-nya harus tetap terbuka.
//
// Modul ini SENGAJA tidak import 'electron': semua path masuk sebagai parameter, jadi tesnya jalan
// di Node biasa dan runner-nya bisa dibuktikan terhadap filesystem sungguhan.

import { promises as fs } from 'node:fs';
import path from 'node:path';

// NSIS baru selesai menulis ke direktorinya beberapa detik sebelum kita melihatnya. Batas umur ini
// yang memisahkan "install yang baru saja jalan" dari "sisa install yang sudah selesai".
export const INSTALL_DIR_MIN_AGE_MS = 10 * 60 * 1000;

// Helper menjalankan installer, menunggu prosesnya keluar, LALU membuka app — jadi saat app start,
// installer itu berumur beberapa detik saja. Batas yang longgar memastikan sweep ini tidak mungkin
// menghapus file yang masih dibutuhkan bagian lain dari update yang baru saja selesai.
export const INSTALLER_MIN_AGE_MS = 60 * 60 * 1000;

// Berapa backup sebelum-switch yang disimpan. Backup itu jaring pengaman untuk satu operasi yang
// gagal, bukan arsip: yang berguna adalah yang paling baru, dan setelah beberapa switch berikutnya
// tidak ada lagi yang bisa memakai yang lama.
export const BACKUPS_KEPT = 5;

// Direktori ns*.tmp milik siapa pun yang membuatnya, jadi "ns" bukan bukti kepemilikan — dan mesin
// ini bisa punya installer aplikasi lain yang sedang jalan. Satu-satunya bukti yang sah adalah
// Sapphire.exe yang kita sendiri dipindahkan ke dalamnya.
export function staleInstallDirs(entries, { now = Date.now(), minAgeMs = INSTALL_DIR_MIN_AGE_MS } = {}) {
  return (entries ?? [])
    .filter((entry) => entry?.hasOldInstall)
    .filter((entry) => now - Number(entry.mtimeMs) > minAgeMs)
    .map((entry) => entry.name);
}

export function staleInstallers(entries, { now = Date.now(), minAgeMs = INSTALLER_MIN_AGE_MS } = {}) {
  return (entries ?? [])
    .filter((entry) => now - Number(entry.mtimeMs) > minAgeMs)
    .map((entry) => entry.name);
}

// Mengembalikan yang HARUS DIBUANG (terlama dulu), bukan yang disimpan — supaya pemanggilnya tidak
// perlu mengulang logika urutannya, dan urutan directory tidak pernah dipercaya sebagai urutan umur.
export function backupsToPrune(entries, keep = BACKUPS_KEPT) {
  const sorted = (entries ?? [])
    .filter(Boolean)
    .sort((a, b) => Number(a.mtimeMs) - Number(b.mtimeMs));
  return sorted.slice(0, Math.max(0, sorted.length - keep)).map((entry) => entry.name);
}

async function listDirectory(directory) {
  try { return await fs.readdir(directory, { withFileTypes: true }); } catch { return []; }
}

async function statSafe(target) {
  try { return await fs.stat(target); } catch { return null; }
}

// Ukuran dikumpulkan SEBELUM menghapus, karena setelahnya tidak ada lagi yang bisa diukur — dan
// angka inilah yang membuat sweep-nya bisa dilaporkan sebagai "sekian MB balik" alih-alih diklaim.
async function measure(target) {
  const info = await statSafe(target);
  if (!info) return 0;
  if (info.isFile()) return info.size;
  let total = 0;
  for (const dirent of await listDirectory(target)) total += await measure(path.join(target, dirent.name));
  return total;
}

// Dijalankan saat app start. Selalu resolve — kegagalan housekeeping tidak boleh menjadi alasan
// Sapphire tidak terbuka.
export async function sweepScratch({ tempRoot, updateDir, now = Date.now() } = {}) {
  const result = { removedDirs: [], removedInstallers: [], bytes: 0 };
  if (!tempRoot) return result;

  for (const dirent of await listDirectory(tempRoot)) {
    if (!dirent.isDirectory() || !/^ns.*\.tmp$/i.test(dirent.name)) continue;
    const full = path.join(tempRoot, dirent.name);
    // Umur diambil dari FILE PENANDA, bukan dari direktori induknya. Direktori `ns*.tmp` dibuat
    // lebih dulu dan mtime-nya bisa tersentuh apa saja yang menulis di dalamnya — sementara
    // Sapphire.exe yang dipindahkan NSIS ke situ punya waktu yang tepat: saat installer mulai.
    const marker = await statSafe(path.join(full, 'old-install', 'Sapphire.exe'));
    const entries = [{
      name: dirent.name,
      mtimeMs: marker?.mtimeMs ?? 0,
      hasOldInstall: Boolean(marker)
    }];
    for (const name of staleInstallDirs(entries, { now })) {
      result.bytes += await measure(full);
      await fs.rm(full, { recursive: true, force: true }).catch(() => {});
      result.removedDirs.push(name);
    }
  }

  // Hanya .exe: helper (`apply-update.cjs`) dan log-nya tidak pernah disentuh di sini, karena
  // keduanya masih berguna setelah install selesai.
  if (updateDir) {
    const files = [];
    for (const dirent of await listDirectory(updateDir)) {
      if (!dirent.isFile() || !/\.exe$/i.test(dirent.name)) continue;
      const info = await statSafe(path.join(updateDir, dirent.name));
      files.push({ name: dirent.name, mtimeMs: info?.mtimeMs ?? 0 });
    }
    for (const name of staleInstallers(files, { now })) {
      const target = path.join(updateDir, name);
      result.bytes += await measure(target);
      await fs.rm(target, { force: true }).catch(() => {});
      result.removedInstallers.push(name);
    }
  }

  return result;
}
