// Whether the PLAY control may be used for one account row, and what it should say.
//
// The rule came out of a real test on a real machine. Pressing PLAY opened Riot Client and
// never started the game: the client accepts a launch request but refuses to act on it
// while the account is not signed in — it starts restoring the session instead and asks for
// a region. From this app the row looked perfectly launchable, which is the bug.
//
// Two conditions, and both are load-bearing:
//   - the account owns the session that is signed in right now (`account.active`), and
//   - a session is actually readable (`sessionLive`).
// `active` alone is not enough, and that is the subtle half: the dashboard falls back to a
// marker file this app's own switcher writes when no live session can be read, so `active`
// can be true with Riot Client closed or parked at its sign-in screen. That state is
// exactly what produced the failed launch.
import { canLaunch } from './errorPresentation.js';

export function canPlay(account, sessionLive) {
  if (!account || !sessionLive) return false;
  return Boolean(account.active) && canLaunch(account.errorKind);
}

export function playTitle(account, sessionLive) {
  const label = account?.label ?? 'this account';
  if (!sessionLive) return 'No account is signed in to Riot Client right now — sign in first';
  if (account?.active) return `Launch Valorant — ${label} is signed in`;
  return `Sign in to ${label} first — PLAY only starts the game for the account already signed in`;
}
