import { describe, expect, it } from 'vitest';
import { launchRequestPath, planPlay, valorantPatchline } from './play.js';

// Everything here is pure text/decision work: which request starts the game, which
// patchline this machine actually has installed, and whether a PLAY press should launch or
// refuse. None of it can be checked by pressing the button, because an accepted request
// says nothing about whether a game window appears.

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

describe('launchRequestPath', () => {
  it('points at the client plugin route its own Play button calls', () => {
    expect(launchRequestPath({ patchline: 'live' }))
      .toBe('/product-launcher/v1/products/valorant/patchlines/live');
  });

  it('defaults to Valorant on live', () => {
    expect(launchRequestPath()).toBe('/product-launcher/v1/products/valorant/patchlines/live');
  });

  it('addresses the PBE patchline when that is what is installed', () => {
    expect(launchRequestPath({ patchline: 'pbe' }))
      .toBe('/product-launcher/v1/products/valorant/patchlines/pbe');
  });

  it('refuses to let a patchline climb out of its path segment', () => {
    // This value comes from a file on disk and lands in a URL path, so a malformed one
    // must not be able to address a different route.
    const path = launchRequestPath({ patchline: 'live/../../admin' });
    expect(path).toBe('/product-launcher/v1/products/valorant/patchlines/liveadmin');
    expect(path).not.toContain('..');
  });

  it('falls back to live for a patchline that sanitises to nothing', () => {
    expect(launchRequestPath({ patchline: '///' }))
      .toBe('/product-launcher/v1/products/valorant/patchlines/live');
  });

  it('escapes the product too, since it shares the path', () => {
    expect(launchRequestPath({ product: 'a/b' }))
      .toBe('/product-launcher/v1/products/a%2Fb/patchlines/live');
  });
});

describe('planPlay', () => {
  it('launches straight away when the game is closed and this account is signed in', () => {
    expect(planPlay({ isActive: true, valorantRunning: false })).toBe('launch');
  });

  it('refuses to relaunch a game that is already open', () => {
    expect(planPlay({ isActive: true, valorantRunning: true })).toBe('already-running');
  });

  it('refuses when the account is not the one signed in', () => {
    // The launch is requested from Riot Client, and a client that is not signed in
    // begins restoring the session instead of acting on it — the request is accepted
    // and then dropped. A real press produced exactly that: the client window opened
    // and the game never started. Switching is a separate, explicit action.
    expect(planPlay({ isActive: false, valorantRunning: false })).toBe('not-signed-in');
  });

  it('refuses for a non-signed-in account even when the game is open under another one', () => {
    expect(planPlay({ isActive: false, valorantRunning: true })).toBe('not-signed-in');
  });
});
