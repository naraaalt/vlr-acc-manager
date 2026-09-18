// Renderer-side error presentation config, keyed by the `errorKind` field the
// electron layer attaches to failures. The classifier itself lives in
// electron/lib/errorKind.js and is imported here rather than duplicated — two
// copies of the same regex table drift apart silently.
import { classifyError } from '../../electron/lib/errorKind.js';

export { classifyError };

// Copy + primary action per kind. `action` values are handled by the caller
// (App.jsx maps them to real handlers).
//
// `launchable` answers a different question from `action`: may the PLAY control be
// offered for an account in this state? It is NOT "did the store load". An expired
// API token says nothing about the saved Riot Client credentials a switch writes —
// those are a separate store, still on disk, which is why this kind's own recovery
// copy is "switching restarts the Riot Client with this account". Hiding PLAY there
// contradicts the guidance the panel right next to it gives, and on a real machine
// every account sat in exactly that state, so the control rendered nowhere.
//
// An entry is unlaunchable when it is unusable AS AN ENTRY: one that points at
// another entry's account, or one whose files could not be read at all.
const ERROR_PRESENTATION = {
  expired: {
    title: 'SESSION EXPIRED',
    explain: 'The saved login for this account is no longer valid — Riot sessions rotate regularly.',
    action: 'switch',
    actionLabel: 'SWITCH ACCOUNT',
    hint: 'Switching restarts the Riot Client with this account and re-saves a fresh session.',
    launchable: true
  },
  'riot-missing': {
    title: 'RIOT CLIENT NOT FOUND',
    explain: 'RiotClientServices.exe is not where this PC keeps it — Riot Client may not be installed, or Windows has no record of where it was put.',
    action: 'refresh-all',
    actionLabel: 'RETRY',
    hint: 'Install Riot Client, or start it once so Windows records its location, then retry.',
    // Launchable, despite reading like a dead end. The failure is the MACHINE's, not this
    // entry's, and muting every row for it is the mistake this table already made once: a
    // per-kind rule that hid PLAY on every account the user actually had.
    launchable: true
  },
  'fs-error': {
    title: 'LOCAL FILE LOCKED',
    explain: 'Windows refused the file write that keeps your accounts index up to date.',
    action: 'refresh-all',
    actionLabel: 'RETRY',
    hint: 'Close the Riot Client and any antivirus scan in progress, then retry. Nothing was lost.',
    launchable: false
  },
  network: {
    title: 'RIOT UNREACHABLE',
    explain: 'The request to Riot’s services timed out or was refused.',
    action: 'refresh-all',
    actionLabel: 'RETRY',
    hint: 'Check your connection — if it’s fine, Riot may be down (status.riotgames.com). Try again in a minute.',
    launchable: true
  },
  duplicate: {
    title: 'DUPLICATE SESSION',
    explain: 'This entry points to the same Riot account as another saved entry.',
    action: 'delete',
    actionLabel: 'DELETE ENTRY',
    hint: 'Keep the other entry (the one that shows this account as ready) and delete this one.',
    launchable: false
  },
  store: {
    title: 'STORE UNAVAILABLE',
    explain: 'Riot’s storefront endpoint rejected or dropped the request.',
    action: 'refresh',
    actionLabel: 'REFRESH STORE',
    hint: 'Usually transient. If it repeats, your session may need a switch to re-issue tokens.',
    launchable: true
  },
  unknown: {
    title: 'SOMETHING WENT WRONG',
    explain: 'An unexpected error occurred while loading this account.',
    action: 'refresh-all',
    actionLabel: 'RETRY',
    hint: 'If retrying doesn’t help, switch to the account once and back.',
    launchable: false
  }
};

export function presentError(error, errorKind) {
  const kind = errorKind && ERROR_PRESENTATION[errorKind] ? errorKind : classifyError(error);
  return { kind, ...ERROR_PRESENTATION[kind] };
}

// May PLAY be offered for an account in this state? No kind at all means the account
// loaded cleanly. A kind the table does not know is treated as unlaunchable — an
// unrecognised failure is not evidence the entry is usable.
export function canLaunch(errorKind) {
  if (!errorKind) return true;
  return ERROR_PRESENTATION[errorKind]?.launchable ?? false;
}
