import { describe, expect, it } from 'vitest';
import { buildLaunchArgs, planPlay, valorantPatchline } from './play.js';

// Everything here is pure text/decision work: what argument vector reaches the
// launcher, which patchline this machine actually has installed, and whether a
// PLAY press should launch, switch first, or refuse. None of it can be checked
// by pressing the button, because a spawn that succeeds says nothing about
// whether a game window appears.

describe('valorantPatchline', () => {
  const installed = (dir) => ({ associated_client: { [dir]: 'C:/Riot Games/Riot Client/RiotClientServices.exe' } });

  it('reads the patchline out of the installed Valorant directory', () => {
    expect(valorantPatchline(installed('E:/Riot Games/VALORANT/live/'))).toBe('live');
  });

  it('reports a PBE install as pbe rather than assuming live', () => {
    expect(valorantPatchline(installed('E:/Riot Games/VALORANT/pbe/'))).toBe('pbe');
  });

  it('does not need a trailing separator', () => {
    expect(valorantPatchline(installed('E:\\Riot Games\\VALORANT\\live'))).toBe('live');
  });

  it('matches the product segment whatever its casing', () => {
    expect(valorantPatchline(installed('e:/riot games/valorant/live/'))).toBe('live');
  });

  it('ignores products that are not Valorant', () => {
    expect(valorantPatchline(installed('C:/Riot Games/League of Legends/live/'))).toBe('live');
  });

  it('is not fooled by a directory that merely contains the word', () => {
    // Segment matching, not substring matching: 'VALORANT-BACKUP' is not the
    // Valorant product directory, so its sibling folder must not be read as a
    // patchline.
    expect(valorantPatchline(installed('E:/VALORANT-BACKUP/banana/'))).toBe('live');
  });

  it('falls back to live when the install map is missing or unreadable', () => {
    expect(valorantPatchline(null)).toBe('live');
    expect(valorantPatchline({})).toBe('live');
    expect(valorantPatchline({ associated_client: null })).toBe('live');
  });

  it('falls back when the product directory names no patchline', () => {
    expect(valorantPatchline(installed('E:/Riot Games/VALORANT/'))).toBe('live');
  });
});

describe('buildLaunchArgs', () => {
  it('asks the launcher for Valorant on the given patchline', () => {
    expect(buildLaunchArgs({ product: 'valorant', patchline: 'live' }))
      .toEqual(['--launch-product=valorant', '--launch-patchline=live']);
  });

  it('defaults to Valorant on live', () => {
    expect(buildLaunchArgs()).toEqual(['--launch-product=valorant', '--launch-patchline=live']);
  });

  it('passes a PBE patchline through', () => {
    expect(buildLaunchArgs({ patchline: 'pbe' }))
      .toEqual(['--launch-product=valorant', '--launch-patchline=pbe']);
  });

  it('refuses to smuggle extra flags through the patchline', () => {
    // The patchline comes from a file on disk, so a malformed one must not be
    // able to append an argument of its choosing to the launcher's command line.
    const args = buildLaunchArgs({ patchline: 'live --install' });
    expect(args).toEqual(['--launch-product=valorant', '--launch-patchline=liveinstall']);
    expect(args.some((arg) => arg.includes(' '))).toBe(false);
  });

  it('falls back to live for a patchline that sanitises to nothing', () => {
    expect(buildLaunchArgs({ patchline: '///' }))
      .toEqual(['--launch-product=valorant', '--launch-patchline=live']);
  });
});

describe('planPlay', () => {
  it('launches straight away when the game is closed and this account is signed in', () => {
    expect(planPlay({ isActive: true, valorantRunning: false })).toBe('launch');
  });

  it('refuses to relaunch a game that is already open', () => {
    expect(planPlay({ isActive: true, valorantRunning: true })).toBe('already-running');
  });

  it('switches first when another account is signed in', () => {
    expect(planPlay({ isActive: false, valorantRunning: false })).toBe('switch-and-launch');
  });

  it('still switches when the game is open under the other account', () => {
    // Switching closes the game as part of writing the new session, so the
    // "already running" guard must not apply here.
    expect(planPlay({ isActive: false, valorantRunning: true })).toBe('switch-and-launch');
  });
});
