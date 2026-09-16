import { describe, expect, it } from 'vitest';
import { buildInstallerArgs, buildHelperSource, helperPath } from './install.js';

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

describe('helperPath', () => {
  it('lives next to the installer in temp', () => {
    expect(helperPath('C:/Temp')).toContain('sapphire-update');
    expect(helperPath('C:/Temp')).toMatch(/\.cjs$/);
  });
});