// Renderer-side error presentation config, keyed by the `errorKind` field the
// electron layer attaches to failures. The classifier itself lives in
// electron/lib/errorKind.js and is imported here rather than duplicated — two
// copies of the same regex table drift apart silently.
import { classifyError } from '../../electron/lib/errorKind.js';

export { classifyError };

// Copy + primary action per kind. `action` values are handled by the caller
// (App.jsx maps them to real handlers).
const ERROR_PRESENTATION = {
  expired: {
    title: 'SESSION EXPIRED',
    explain: 'The saved login for this account is no longer valid — Riot sessions rotate regularly.',
    action: 'switch',
    actionLabel: 'SWITCH ACCOUNT',
    hint: 'Switching restarts the Riot Client with this account and re-saves a fresh session.'
  },
  'fs-error': {
    title: 'LOCAL FILE LOCKED',
    explain: 'Windows refused the file write that keeps your accounts index up to date.',
    action: 'refresh-all',
    actionLabel: 'RETRY',
    hint: 'Close the Riot Client and any antivirus scan in progress, then retry. Nothing was lost.'
  },
  network: {
    title: 'RIOT UNREACHABLE',
    explain: 'The request to Riot’s services timed out or was refused.',
    action: 'refresh-all',
    actionLabel: 'RETRY',
    hint: 'Check your connection — if it’s fine, Riot may be down (status.riotgames.com). Try again in a minute.'
  },
  duplicate: {
    title: 'DUPLICATE SESSION',
    explain: 'This entry points to the same Riot account as another saved entry.',
    action: 'delete',
    actionLabel: 'DELETE ENTRY',
    hint: 'Keep the other entry (the one that shows this account as ready) and delete this one.'
  },
  store: {
    title: 'STORE UNAVAILABLE',
    explain: 'Riot’s storefront endpoint rejected or dropped the request.',
    action: 'refresh',
    actionLabel: 'REFRESH STORE',
    hint: 'Usually transient. If it repeats, your session may need a switch to re-issue tokens.'
  },
  unknown: {
    title: 'SOMETHING WENT WRONG',
    explain: 'An unexpected error occurred while loading this account.',
    action: 'refresh-all',
    actionLabel: 'RETRY',
    hint: 'If retrying doesn’t help, switch to the account once and back.'
  }
};

export function presentError(error, errorKind) {
  const kind = errorKind && ERROR_PRESENTATION[errorKind] ? errorKind : classifyError(error);
  return { kind, ...ERROR_PRESENTATION[kind] };
}
