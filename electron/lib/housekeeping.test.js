import { mkdtemp, mkdir, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKUPS_KEPT, INSTALLER_MIN_AGE_MS, INSTALL_DIR_MIN_AGE_MS,
  backupsToPrune, staleInstallDirs, staleInstallers, sweepScratch
} from './housekeeping.js';

// The app left real garbage on this machine: six NSIS directories holding a copy of the OLD
// Sapphire.exe (1.3 GB), and a downloaded installer that was never deleted after a successful
// install (100 MB per version). None of it was ever collected. These tests pin the RULES that
// decide what is safe to delete, because the risky half of housekeeping is deleting too much:
// another app's installer, or one that is still running, must survive.

const MINUTE = 60 * 1000;
const entry = (name, ageMs, extra = {}) => ({ name, mtimeMs: Date.now() - ageMs, ...extra });

describe('staleInstallDirs', () => {
  it('removes an old directory that still holds our replaced executable', () => {
    const dirs = [entry('nsABCD1.tmp', 3 * 60 * MINUTE, { hasOldInstall: true })];
    expect(staleInstallDirs(dirs)).toEqual(['nsABCD1.tmp']);
  });

  it('keeps a directory whose install may still be running', () => {
    // NSIS moves the old exe aside at the START of an install and cleans up at the end. Deleting
    // mid-install would break the install that is happening right now.
    const dirs = [entry('nsABCD1.tmp', 30 * 1000, { hasOldInstall: true })];
    expect(staleInstallDirs(dirs)).toEqual([]);
  });

  it('keeps a directory that is not ours, however old it is', () => {
    // ns*.tmp belongs to whichever installer created it, and this machine can have another app's
    // installer in flight. The only proof of ownership is our own exe inside it.
    const dirs = [entry('nsOTHER.tmp', 90 * 24 * 60 * MINUTE, { hasOldInstall: false })];
    expect(staleInstallDirs(dirs)).toEqual([]);
  });

  it('takes the boundary exactly at the minimum age', () => {
    const dirs = [entry('nsOLD.tmp', INSTALL_DIR_MIN_AGE_MS + MINUTE, { hasOldInstall: true })];
    expect(staleInstallDirs(dirs)).toEqual(['nsOLD.tmp']);
  });

  it('survives an empty or shapeless list', () => {
    expect(staleInstallDirs([])).toEqual([]);
    expect(staleInstallDirs(undefined)).toEqual([]);
  });
});

describe('staleInstallers', () => {
  it('removes a downloaded installer that has been sitting there', () => {
    // The helper deletes the installer after a successful install. This sweep is the backstop for
    // the cases the helper cannot cover: an install that crashed, or one run by a build old enough
    // to predate the deletion.
    const files = [entry('Sapphire.Setup.0.1.5.exe', 3 * 60 * MINUTE)];
    expect(staleInstallers(files)).toEqual(['Sapphire.Setup.0.1.5.exe']);
  });

  it('keeps one that was just used, because the relaunched app starts seconds after it exits', () => {
    // The helper runs the installer, waits for it to exit, and THEN launches the app — so at app
    // start the installer is seconds old. A generous age guard means the sweep can never delete a
    // file some other part of a just-finished update might still want.
    const files = [entry('Sapphire.Setup.0.1.6.exe', 5 * 1000)];
    expect(staleInstallers(files)).toEqual([]);
    expect(INSTALLER_MIN_AGE_MS).toBeGreaterThan(60 * 1000);
  });
});

describe('backupsToPrune', () => {
  const backups = (count) => Array.from({ length: count }, (_, index) => entry(`before-switch-${index}.vam`, (count - index) * MINUTE));

  it('keeps the newest and returns the rest, oldest first', () => {
    // 27 files had accumulated over three days — 245 MB with no pruning anywhere in the codebase.
    const pruned = backupsToPrune(backups(8), 5);
    expect(pruned).toEqual(['before-switch-0.vam', 'before-switch-1.vam', 'before-switch-2.vam']);
  });

  it('deletes nothing while the count is within the limit', () => {
    expect(backupsToPrune(backups(5), 5)).toEqual([]);
    expect(backupsToPrune(backups(2), 5)).toEqual([]);
  });

  it('keeps the NEWEST when the order in is scrambled', () => {
    // Directory order is not age order; the selector must sort rather than trust the caller.
    const scrambled = [
      entry('old.vam', 500 * MINUTE), entry('newest.vam', 1 * MINUTE),
      entry('middle.vam', 60 * MINUTE), entry('older.vam', 900 * MINUTE)
    ];
    expect(backupsToPrune(scrambled, 2)).toEqual(['older.vam', 'old.vam']);
  });

  it('defaults to a limit that actually prunes something', () => {
    expect(BACKUPS_KEPT).toBeGreaterThan(0);
    expect(BACKUPS_KEPT).toBeLessThan(50);
  });
});

// The rules above are only worth anything if the runner applies them to a real filesystem, so these
// tests build one. Every path is under a fresh mkdtemp: nothing here can touch the real machine.
describe('sweepScratch', () => {
  const plant = async (root, relative, { age = 3 * 60 * MINUTE } = {}) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, 'x');
    const when = new Date(Date.now() - age);
    await utimes(file, when, when);
    return file;
  };
  const exists = async (file) => { try { await stat(file); return true; } catch { return false; } };

  async function fixture() {
    const root = await mkdtemp(path.join(tmpdir(), 'sapphire-sweep-'));
    const updateDir = path.join(root, 'sapphire-update');
    // ours, stale -> gone
    await plant(root, 'nsOURS.tmp/old-install/Sapphire.exe');
    // ours, fresh (an install in flight) -> kept
    await plant(root, 'nsBUSY.tmp/old-install/Sapphire.exe', { age: 5 * 1000 });
    // not ours, however old -> kept
    await plant(root, 'nsTHEIRS.tmp/payload.dat');
    // installer, stale -> gone; freshly used -> kept; the helper and its log -> always kept
    await plant(root, 'sapphire-update/Sapphire.Setup.0.1.5.exe');
    await plant(root, 'sapphire-update/Sapphire.Setup.0.1.6.exe', { age: 5 * 1000 });
    await plant(root, 'sapphire-update/apply-update.cjs');
    await plant(root, 'sapphire-update/update.log');
    return { root, updateDir };
  }

  it('removes exactly the stale things it owns and nothing else', async () => {
    const { root, updateDir } = await fixture();
    try {
      const result = await sweepScratch({ tempRoot: root, updateDir });
      expect(result.removedDirs).toEqual(['nsOURS.tmp']);
      expect(result.removedInstallers).toEqual(['Sapphire.Setup.0.1.5.exe']);
      // The evidence that it kept what matters, asserted by name rather than by a count.
      expect(await exists(path.join(root, 'nsBUSY.tmp/old-install/Sapphire.exe'))).toBe(true);
      expect(await exists(path.join(root, 'nsTHEIRS.tmp/payload.dat'))).toBe(true);
      expect(await exists(path.join(updateDir, 'Sapphire.Setup.0.1.6.exe'))).toBe(true);
      expect(await exists(path.join(updateDir, 'apply-update.cjs'))).toBe(true);
      expect(await exists(path.join(updateDir, 'update.log'))).toBe(true);
      expect(await exists(path.join(root, 'nsOURS.tmp'))).toBe(false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('reports the bytes it reclaimed, so the saving is a measured number', async () => {
    const { root, updateDir } = await fixture();
    try {
      const result = await sweepScratch({ tempRoot: root, updateDir });
      expect(result.bytes).toBeGreaterThan(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('is idempotent: a second sweep finds nothing and does not throw', async () => {
    const { root, updateDir } = await fixture();
    try {
      await sweepScratch({ tempRoot: root, updateDir });
      const again = await sweepScratch({ tempRoot: root, updateDir });
      expect(again.removedDirs).toEqual([]);
      expect(again.removedInstallers).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('never throws when the directories do not exist at all', async () => {
    // This runs during app startup. A housekeeping failure must never be the reason Sapphire does
    // not open, so a missing temp root is a no-op rather than an error.
    await expect(sweepScratch({ tempRoot: path.join(tmpdir(), 'does-not-exist-at-all'), updateDir: path.join(tmpdir(), 'also-missing') }))
      .resolves.toMatchObject({ removedDirs: [], removedInstallers: [] });
  });

  it('leaves a plain file in temp alone', async () => {
    const { root, updateDir } = await fixture();
    try {
      await plant(root, 'unrelated.txt');
      await sweepScratch({ tempRoot: root, updateDir });
      expect(await exists(path.join(root, 'unrelated.txt'))).toBe(true);
      expect((await readdir(root)).sort()).toEqual(['nsBUSY.tmp', 'nsTHEIRS.tmp', 'sapphire-update', 'unrelated.txt']);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
