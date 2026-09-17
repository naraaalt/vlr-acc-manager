import { describe, expect, it } from 'vitest';
import { canPlay, playTitle } from './playGate.js';

// Whether PLAY may be pressed for one row. This is the rule that came out of a real
// test on a real machine, where pressing PLAY opened Riot Client and never started the
// game: the client accepts a launch request but refuses to act on it while the account
// is not signed in — it begins restoring the session instead and asks the user to pick
// a region. The row looked launchable and was not.
//
// So the gate has two parts, and both are needed:
//   - the account must own the session that is SIGNED IN right now (`active`), and
//   - a session must actually be readable (`live`).
// `active` alone is not enough. The dashboard falls back to a marker file written by
// this app's own switcher when no live session can be read, so `active` can be true
// with Riot Client closed or sitting at its sign-in screen — exactly the state that
// produced the failed launch.

const signedIn = { label: 'main', active: true };
const other = { label: 'alt', active: false };

describe('canPlay', () => {
  it('allows PLAY for the account that owns the signed-in session', () => {
    expect(canPlay(signedIn, true)).toBe(true);
  });

  it('refuses when a DIFFERENT account owns the session — that press would sign in first', () => {
    expect(canPlay(other, true)).toBe(false);
  });

  it('refuses while no session is readable, because active may only be the marker file', () => {
    // This is the case the machine actually hit: Riot Client running but not signed
    // in, and the account flagged active from the switcher's marker alone.
    expect(canPlay(signedIn, false)).toBe(false);
  });

  it('allows PLAY for a signed-in account whose STORE session expired', () => {
    // The store token expiring says nothing about the Riot Client session, and this is
    // the ordinary state of an account that has not been opened for a while.
    expect(canPlay({ ...signedIn, errorKind: 'expired' }, true)).toBe(true);
  });

  it('refuses for an entry that is unusable as an entry, even when flagged active', () => {
    // Files that could not be read, or an entry pointing at another account's record.
    expect(canPlay({ ...signedIn, errorKind: 'fs-error' }, true)).toBe(false);
    expect(canPlay({ ...signedIn, errorKind: 'duplicate' }, true)).toBe(false);
  });

  it('refuses when anything it needs is missing', () => {
    expect(canPlay(null, true)).toBe(false);
    expect(canPlay(undefined, true)).toBe(false);
    expect(canPlay({}, true)).toBe(false);
    expect(canPlay({ label: 'lonely' }, true)).toBe(false);
    expect(canPlay(signedIn, undefined)).toBe(false);
  });
});

describe('playTitle', () => {
  it('says what the press will do when it is allowed', () => {
    expect(playTitle(signedIn, true)).toBe('Launch Valorant — main is signed in');
  });

  it('says how to get there when the account is not signed in', () => {
    expect(playTitle(other, true)).toBe('Sign in to alt first — PLAY only starts the game for the account already signed in');
  });

  it('says so when no account is signed in anywhere', () => {
    expect(playTitle(signedIn, false)).toBe('No account is signed in to Riot Client right now — sign in first');
  });
});
