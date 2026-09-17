// Whether the PLAY control may be used for one account row, and what it should say.
//
// This rule was rewritten after a real test on a real machine. The first version refused the
// press unless the account was ALREADY the signed-in one, on the evidence that a client
// which is not signed in accepts a launch request and then drops it. That part was true; the
// conclusion drawn from it was wrong. It made the control refuse on every row the user
// actually cares about, because a manager holds the accounts you are NOT currently in — on
// the machine this was built for, all three saved accounts sat in exactly that state and the
// button was muted everywhere.
//
// What the client will not do is launch while somebody else is signed in. It is perfectly
// willing to be switched first, which is what this app already does, so PLAY performs the
// switch itself and then launches. One press, no refusal.
//
// The gate therefore asks one question, not two: can this ENTRY be used at all? An entry
// pointing at another entry's account, or one whose files could not be read, cannot be
// switched and so cannot be launched either. Everything else can, signed in or not.
import { canLaunch } from './errorPresentation.js';

export function canPlay(account) {
  if (!account) return false;
  return canLaunch(account.errorKind);
}

export function playTitle(account) {
  const label = account?.label ?? 'this account';
  if (!canLaunch(account?.errorKind)) {
    return `PLAY is off for ${label} — its saved login cannot be used to switch`;
  }
  if (account?.active) return `Launch Valorant — ${label} is signed in`;
  return `Launch Valorant with ${label} — switches the Riot Client first`;
}
