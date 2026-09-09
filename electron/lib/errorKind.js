// Error classification: maps raw error messages thrown across the electron
// layer to stable "kinds" so the UI can show cause-appropriate recovery
// actions instead of one generic retry. Single source of truth shared by
// main (wrapping) and renderer (rendering).

const KINDS = {
  expired: 'expired',       // saved API session/token no longer valid → switch & re-save
  'fs-error': 'fs-error',   // local file lock/permission (EPERM/EACCES/EBUSY) → close Riot/AV, retry
  network: 'network',       // Riot service unreachable/timeout → check connection, retry later
  duplicate: 'duplicate',   // saved session duplicates another account → delete the dup
  store: 'store',           // storefront-specific failure → refresh market later
  unknown: 'unknown'
};

// Ordered: most specific patterns first (a message matching two rules wins
// the earlier kind).
const RULES = [
  ['expired', /expired/i],
  ['duplicate', /duplicates?\s|already saved as/i],
  ['fs-error', /\bEPERM\b|\bEACCES\b|\bEBUSY\b|\bENOENT\b|operation not permitted|permission denied/i],
  ['network', /took too long|timed?\s?out|ENOTFOUND|ECONNRESET|ECONNREFUSED|EAI_AGAIN|network|fetch failed|status service|content service/i],
  ['store', /storefront|store request failed|daily skin offers|store skins/i]
];

export function classifyError(message) {
  const text = String(message ?? '');
  for (const [kind, pattern] of RULES) {
    if (pattern.test(text)) return kind;
  }
  return KINDS.unknown;
}

export function isValidKind(kind) {
  return Boolean(kind && KINDS[kind]);
}

// Helper for accountService: throw an Error carrying a stable kind.
export function fail(kind, message) {
  const error = new Error(message);
  error.kind = isValidKind(kind) ? kind : KINDS.unknown;
  return error;
}
