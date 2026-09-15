// Account list ordering.
//
// Invariant (explicit requirement): the account whose saved Riot session is
// currently signed in always sits first, so it survives an app restart. The
// backend recomputes `active` on every dashboard load from the live session
// PUUID, so "signed in" here always means "this account's token is valid right
// now" — never a stale local flag.
//
// The order of the remaining accounts is preserved exactly as received: the
// backend already sorts them by lastCheckedAt descending, and re-sorting here
// would silently override that.
//
// It is a pure function of the list so it can be tested without a renderer.

export const SORT_MODES = ['active', 'label', 'level', 'rank'];

// Human labels for the UI (sort button, toast). Kept next to the modes so a new
// mode cannot be added without a label.
export const SORT_LABELS = {
  active: 'SIGNED IN',
  label: 'NAME A-Z',
  level: 'LEVEL',
  rank: 'RANK'
};

// Highest tier first, unranked last. Uses the numeric tier the rank parser
// produces so "Ascendant 2" beats "Diamond 1" without a hardcoded ladder here.
export function orderAccounts(accounts, mode = 'active', rankTierOf = null) {
  const list = Array.isArray(accounts) ? accounts : [];
  // Split rather than sort: Array.prototype.sort is stable in modern engines,
  // but an explicit split makes the active-first invariant obvious and immune
  // to a future engine change.
  const signIn = list.filter((account) => account?.active);
  const rest = list.filter((account) => !account?.active);

  const byLabel = (a, b) => String(a?.label ?? '').localeCompare(String(b?.label ?? ''), undefined, { sensitivity: 'base' });
  const byLevel = (a, b) => (b?.store?.profile?.level ?? -1) - (a?.store?.profile?.level ?? -1);
  const byRank = (a, b) => {
    const tier = (account) => {
      const name = account?.store?.profile?.rank;
      if (!name || !rankTierOf) return -1;
      const parsed = rankTierOf(name);
      return parsed ? parsed.tier : -1;
    };
    return tier(b) - tier(a);
  };

  const comparators = { label: byLabel, level: byLevel, rank: byRank };
  const comparator = comparators[mode];
  const ordered = comparator ? [...rest].sort(comparator) : rest;

  return [...signIn, ...ordered];
}
