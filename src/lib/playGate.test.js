import { describe, expect, it } from 'vitest';
import { canPlay, playTitle } from './playGate.js';

// Whether PLAY may be pressed for one row.
//
// This rule was rewritten after a real test on a real machine. The first version refused
// the press unless the account was ALREADY the signed-in one, on the evidence that a client
// which is not signed in accepts a launch request and then drops it. That was true, and the
// conclusion drawn from it was wrong: it made the control refuse on every row the user
// actually cared about, because a manager holds the accounts you are NOT currently in.
//
// What the client will not do is launch while it is signed in as somebody else. It is
// perfectly happy to be switched first — that is what this app already does — so PLAY
// performs the switch itself and then launches. One press, no refusal.
//
// The gate therefore asks one question, not two: can this ENTRY be used at all? An entry
// that points at another entry's account, or whose files could not be read, cannot be
// switched and so cannot be launched either. Everything else can.

const signedIn = { label: 'main', active: true };
const other = { label: 'alt', active: false };

describe('canPlay', () => {
  it('allows PLAY for the account that owns the signed-in session', () => {
    expect(canPlay(signedIn)).toBe(true);
  });

  it('allows PLAY for every other row too, because a press switches first', () => {
    expect(canPlay(other)).toBe(true);
  });

  it('allows PLAY while no session is readable at all', () => {
    // The ordinary state of a saved account that has not been opened for a while, and the
    // state the whole list sat in on the machine that prompted this rewrite.
    expect(canPlay({ label: 'alt', active: false })).toBe(true);
  });

  it('allows PLAY for an account whose STORE session expired', () => {
    // The store token expiring says nothing about the Riot Client credentials a switch
    // writes — those are a separate store, still on disk.
    expect(canPlay({ ...other, errorKind: 'expired' })).toBe(true);
  });

  it('allows PLAY for an entry whose store merely failed to load', () => {
    expect(canPlay({ ...other, errorKind: 'network' })).toBe(true);
    expect(canPlay({ ...other, errorKind: 'store' })).toBe(true);
  });

  it('refuses for an entry that is unusable as an entry, even when flagged active', () => {
    // Files that could not be read, or an entry pointing at another account's record.
    // Switching to one of these cannot work, so offering a launch through it would lie.
    expect(canPlay({ ...signedIn, errorKind: 'fs-error' })).toBe(false);
    expect(canPlay({ ...signedIn, errorKind: 'duplicate' })).toBe(false);
    expect(canPlay({ ...signedIn, errorKind: 'unknown' })).toBe(false);
  });

  it('refuses when there is no account to act on', () => {
    expect(canPlay(null)).toBe(false);
    expect(canPlay(undefined)).toBe(false);
  });
});

describe('playTitle', () => {
  it('says the press is a plain launch when the account is already signed in', () => {
    expect(playTitle(signedIn)).toBe('Launch Valorant — main is signed in');
  });

  it('says the press switches first when the account is not signed in', () => {
    expect(playTitle(other)).toBe('Launch Valorant with alt — switches the Riot Client first');
  });

  it('explains the refusal rather than leaving a muted button unexplained', () => {
    expect(playTitle({ label: 'broken', errorKind: 'fs-error' }))
      .toBe('PLAY is off for broken — its saved login cannot be used to switch');
  });

  it('does not claim a disabled control is launchable', () => {
    // The readable half of the same rule: a title that promises a launch on a row whose
    // button is muted is worse than no title at all.
    expect(playTitle({ label: 'broken', errorKind: 'duplicate' })).toContain('PLAY is off');
  });
});
