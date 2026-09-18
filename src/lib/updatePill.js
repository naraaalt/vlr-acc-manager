// What the update pill says, as a pure function.
//
// The pill is the only update surface visible while the settings panel is shut, which is
// exactly when a press happens: the confirm dialog is dismissed, then the download runs behind
// a pill that never changed, and the app quits a fraction of a second after it finally does.
// A person pressing UPDATE and watching a header that stays on "UPDATE 0.1.6" for twenty
// seconds cannot tell a working download from a dead button, and the version only changes
// after a restart — so the one moment it must be explicit is the one it used to be silent.
//
// The states, in the order a press passes through them:
//   available    nothing started yet
//   downloading  a real number once the server sends a length, '…' until then
//   ready        downloaded and verified, waiting on the install step
//   installing   the helper is running and this window is about to close
//   error        the last attempt failed; it must not read as "nothing to do"
export function updatePillText({ status, progress, latestVersion } = {}) {
  const version = latestVersion ?? '';
  if (status === 'downloading') {
    const percent = downloadPercent(progress);
    return percent === null ? 'DOWNLOADING…' : `DOWNLOADING ${percent}%`;
  }
  if (status === 'installing') return 'INSTALLING…';
  if (status === 'ready') return 'RESTARTING…';
  if (status === 'error') return 'UPDATE FAILED';
  return version ? `UPDATE ${version}` : 'UPDATE';
}

// Whole percent, or null when the response carried no length. GitHub serves these from a
// redirect and some CDNs omit content-length; showing a fabricated 0% for that case is worse
// than showing that it is working without saying how far along.
export function downloadPercent(progress) {
  const received = Number(progress?.received);
  const total = Number(progress?.total);
  if (!Number.isFinite(received) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((received / total) * 100)));
}

// Whether the pill may still be pressed, and whether its dismiss cross is still offered.
// A second press during a download restarts it, and dismissing the notice mid-update hides the
// only thing reporting progress — so both close while the update is in flight.
export function updateInFlight(status) {
  return status === 'downloading' || status === 'ready' || status === 'installing';
}

export function updateBusyLabel(status) {
  if (status === 'installing') return 'the installer is starting';
  if (status === 'ready') return 'starting the installer';
  return 'downloading the update';
}
