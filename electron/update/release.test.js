import { describe, expect, it } from 'vitest';
import { compareVersions, pickInstaller, readRelease } from './release.js';

// Versi dibandingkan sebagai ANGKA per bagian. Perbandingan string punya bug klasik:
// '0.1.10' < '0.1.9' secara leksikografis, artinya app bakal berhenti nawarin update
// selamanya begitu versi ke-10 rilis — dan gagalnya SENYAP.
describe('compareVersions', () => {
  it('treats the tenth patch as newer than the ninth', () => {
    expect(compareVersions('0.1.10', '0.1.9')).toBe(1);
  });
  it('reports equal versions as equal', () => {
    expect(compareVersions('0.1.2', '0.1.2')).toBe(0);
  });
  it('treats a missing part as zero', () => {
    expect(compareVersions('0.1', '0.1.0')).toBe(0);
    expect(compareVersions('0.2', '0.1.9')).toBe(1);
  });
  it('ignores a leading v', () => {
    expect(compareVersions('v0.1.3', '0.1.2')).toBe(1);
  });
  it('reports an older version as older', () => {
    expect(compareVersions('0.1.1', '0.1.2')).toBe(-1);
  });
});

describe('pickInstaller', () => {
  const assets = [
    { name: 'Sapphire 0.1.3.exe', browser_download_url: 'https://x/portable' },
    { name: 'Sapphire Setup 0.1.3.exe', browser_download_url: 'https://x/setup', size: 100, digest: 'sha256:abc' },
    { name: 'latest.yml', browser_download_url: 'https://x/yml' }
  ];
  it('picks the NSIS installer, not the portable build', () => {
    expect(pickInstaller(assets).browser_download_url).toBe('https://x/setup');
  });
  // GitHub menormalkan spasi di nama asset hasil upload REST jadi TITIK. Fixture yang cuma
  // memakai nama berspasi bikin bug ini lolos dari unit test dan baru ketahuan dari release
  // SUNGGUHAN: updater tidak menemukan installer-nya dan berhenti menawarkan update.
  it('accepts the dot-normalised name GitHub actually stores', () => {
    expect(pickInstaller([{ name: 'Sapphire.Setup.0.1.3.exe', browser_download_url: 'https://x/setup' }]).browser_download_url).toBe('https://x/setup');
  });
  it('still refuses the portable build under either spelling', () => {
    expect(pickInstaller([{ name: 'Sapphire.0.1.3.exe' }])).toBeNull();
    expect(pickInstaller([{ name: 'Sapphire 0.1.3.exe' }])).toBeNull();
  });
  it('returns null when no installer was attached', () => {
    expect(pickInstaller([{ name: 'notes.txt' }])).toBeNull();
    expect(pickInstaller([])).toBeNull();
    expect(pickInstaller(undefined)).toBeNull();
  });
});

describe('readRelease', () => {
  const release = {
    tag_name: 'v0.1.3',
    body: 'Fixed the thing.',
    published_at: '2026-09-16T00:00:00Z',
    assets: [{ name: 'Sapphire Setup 0.1.3.exe', browser_download_url: 'https://x/setup', size: 99, digest: 'sha256:deadbeef' }]
  };

  it('reports an update when the tag is newer and an installer is attached', () => {
    const result = readRelease(release, '0.1.2');
    expect(result.available).toBe(true);
    expect(result.latestVersion).toBe('0.1.3');
    expect(result.installer.name).toBe('Sapphire Setup 0.1.3.exe');
    expect(result.installer.digest).toBe('sha256:deadbeef');
    expect(result.reason).toBe('ok');
  });

  // 404 dari /releases/latest = "belum ada release", dan repo ini MEMANG belum punya.
  // Kalau ini diperlakukan sebagai error, user baru bakal lihat pesan gagal terus.
  it('treats a missing release as up to date, not as a failure', () => {
    const result = readRelease(null, '0.1.2');
    expect(result.available).toBe(false);
    expect(result.reason).toBe('no-releases');
  });

  it('reports up-to-date when the tag is not newer', () => {
    expect(readRelease({ ...release, tag_name: 'v0.1.2' }, '0.1.2').reason).toBe('up-to-date');
    expect(readRelease({ ...release, tag_name: 'v0.1.1' }, '0.1.2').reason).toBe('up-to-date');
  });

  it('ignores prereleases and drafts', () => {
    expect(readRelease({ ...release, prerelease: true }, '0.1.2').available).toBe(false);
    expect(readRelease({ ...release, prerelease: true }, '0.1.2').reason).toBe('prerelease');
    expect(readRelease({ ...release, draft: true }, '0.1.2').reason).toBe('draft');
  });

  it('is honest when a newer version has no installer attached', () => {
    const result = readRelease({ ...release, assets: [] }, '0.1.2');
    expect(result.available).toBe(false);
    expect(result.reason).toBe('no-installer');
    expect(result.latestVersion).toBe('0.1.3');
  });

  it('treats a malformed payload as unusable rather than crashing', () => {
    expect(readRelease({ nope: 1 }, '0.1.2').reason).toBe('malformed');
    expect(readRelease('hi', '0.1.2').reason).toBe('malformed');
  });
});