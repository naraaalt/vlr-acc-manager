// Discards the garbage left behind by the update process: the NSIS installer moves the old Sapphire.exe to
// `%TEMP%\nsXXXX.tmp\old-install\` then abandons that directory (225 MB per install — measured
// 1.3 GB after six updates), and a downloaded installer (100 MB per version) is never
// deleted. The sweep pattern already exists in accountStore.js (`sweepStaleTempFiles`).
//
// WHAT IS RISKY IS NOT DELETING, BUT DELETING TOO MUCH: so every decision lives in a
// pure function that can be tested, and its runner is best-effort — a file that fails to delete is retried on the
// next launch, while the app must stay open.
//
// DELIBERATELY does not import 'electron': all paths come in as parameters, so its tests run on plain Node.

import { promises as fs } from 'node:fs';
import path from 'node:path';

// NSIS only finishes writing to its directory a few seconds before we look at it. This age limit is
// what separates "an install that just ran" from "the leftovers of an install that has finished".
export const INSTALL_DIR_MIN_AGE_MS = 10 * 60 * 1000;

// The helper runs the installer, waits for the process to exit, THEN opens the app — so when the app starts,
// that installer is only a few seconds old. A loose limit makes sure this sweep can never
// delete a file another part of the just-finished update still needs.
export const INSTALLER_MIN_AGE_MS = 60 * 60 * 1000;

// How many pre-switch backups are kept. A backup is a safety net for a single failed
// operation, not an archive: the useful one is the newest, and after a few more switches
// nothing can use the old ones anymore.
export const BACKUPS_KEPT = 5;

// The ns*.tmp directory belongs to whoever created it, so "ns" is not proof of ownership — and this machine
// can have another app's installer running. The only valid proof is
// the Sapphire.exe that we ourselves moved into it.
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

// Returns the ones that MUST BE DISCARDED (oldest first), not the ones kept — so the caller does not
// have to repeat the ordering logic, and directory order is never trusted as age order.
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

// Sizes are collected BEFORE deleting, because afterwards there is nothing left to measure — and
// this number is what lets the sweep be reported as "so many MB back" instead of merely claimed.
async function measure(target) {
  const info = await statSafe(target);
  if (!info) return 0;
  if (info.isFile()) return info.size;
  let total = 0;
  for (const dirent of await listDirectory(target)) total += await measure(path.join(target, dirent.name));
  return total;
}

// Runs on app start. Always resolves — a housekeeping failure must not be a reason
// for Sapphire not opening.
export async function sweepScratch({ tempRoot, updateDir, now = Date.now() } = {}) {
  const result = { removedDirs: [], removedInstallers: [], bytes: 0 };
  if (!tempRoot) return result;

  for (const dirent of await listDirectory(tempRoot)) {
    if (!dirent.isDirectory() || !/^ns.*\.tmp$/i.test(dirent.name)) continue;
    const full = path.join(tempRoot, dirent.name);
    // The age is taken from the MARKER FILE, not from its parent directory. The `ns*.tmp` directory is created
    // earlier and its mtime can be touched by anything writing inside it — while
    // the Sapphire.exe NSIS moved in there has exactly the right time: when the installer started.
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

  // .exe only: the helper (`apply-update.cjs`) and its logs are never touched here, because
  // both are still useful after the install finishes.
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
