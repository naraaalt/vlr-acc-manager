import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildHelperSource, buildInstallerArgs, helperPath, writeHelper } from './install.js';

describe('buildInstallerArgs', () => {
  // NSIS: /D= harus parameter TERAKHIR dan tidak boleh dikutip, walaupun path-nya ada spasi.
  // spawn() dengan array argumen tidak lewat shell, jadi tidak ada yang perlu di-escape.
  it('puts /D last', () => {
    expect(buildInstallerArgs('C:/Apps/Sapphire')).toEqual(['/S', '/D=C:/Apps/Sapphire']);
  });
  it('keeps a path with spaces as one single argument', () => {
    expect(buildInstallerArgs('C:/Program Files/Sapphire')).toEqual(['/S', '/D=C:/Program Files/Sapphire']);
  });
  it('omits /D when we do not know the install dir', () => {
    expect(buildInstallerArgs(null)).toEqual(['/S']);
    expect(buildInstallerArgs('')).toEqual(['/S']);
  });
});

describe('buildHelperSource', () => {
  const source = buildHelperSource();

  it('waits for the parent process before installing', () => {
    expect(source).toContain('process.kill(parentPid, 0)');
  });
  it('runs the installer silently', () => {
    expect(source).toContain("'/S'");
  });
  it('relaunches the app afterwards', () => {
    expect(source).toContain('detached: true');
  });
  it('relaunches the app WITHOUT the flag that would turn it into a bare Node process', () => {
    // Helper dijalankan dengan ELECTRON_RUN_AS_NODE=1, dan spawn() mewariskan environment —
    // jadi tanpa membersihkannya, Sapphire yang dijalankan ulang bangun sebagai Node tanpa
    // script: keluar seketika, tanpa jendela. Versi pertama dari tes ini hanya memeriksa
    // 'detached: true' dan lolos, karena masalahnya ada di environment, bukan di cara spawn.
    expect(source).toContain('delete cleanEnv.ELECTRON_RUN_AS_NODE');
    expect(source).toMatch(/spawn\(exePath, \[\], \{[^}]*env: cleanEnv/);
  });
  it('supports a dry run so the mechanism can be verified without an update', () => {
    // Dry run = lewati installer tapi tetap tinggalkan jejak. Itu yang membuat T3.5 bisa
    // membuktikan mekanismenya TANPA benar-benar mengupdate app.
    expect(source).toContain("dryRun === 'true'");
    expect(source).toContain('dry-run-marker.txt');
    expect(source).toContain('not running the installer');
  });
  it('writes a log, because stdio is ignored and a silent failure is undiagnosable', () => {
    expect(source).toContain('update.log');
  });
  // Helper dijalankan sebagai Node biasa, jadi tidak boleh ada sintaks yang cuma ada di Electron.
  it('uses only node builtins', () => {
    expect(source).toContain("require('node:child_process')");
    expect(source).not.toContain('require(\'electron\')');
  });
});

// Ditemukan dari UPDATE SUNGGUHAN, bukan dari unit test: runUpdateHelper MEN-spawn path helper,
// dan tidak ada apa pun yang menulis file itu. Electron dijalankan sebagai Node dengan path yang
// tidak ada akan keluar seketika TANPA pesan, karena stdio-nya sengaja diabaikan — jadi gejalanya
// "app menutup, versi tidak berubah, tidak ada log". Tes teks di atas tidak bisa menangkapnya, dan
// proof dry-run juga tidak, karena proof itu MENULIS sendiri file helper-nya.
describe('writeHelper', () => {
  it('writes the generated helper to disk, because nothing else does', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sapphire-helper-test-'));
    try {
      const written = writeHelper(root);
      expect(written).toBe(helperPath(root));
      expect(await readFile(written, 'utf8')).toBe(buildHelperSource());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('helperPath', () => {
  it('lives next to the installer in temp', () => {
    expect(helperPath('C:/Temp')).toContain('sapphire-update');
    expect(helperPath('C:/Temp')).toMatch(/\.cjs$/);
  });
});