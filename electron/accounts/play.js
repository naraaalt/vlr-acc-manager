// Pure decisions behind the PLAY control: which argument vector reaches the
// launcher, which patchline this machine actually has installed, and whether a
// press should launch, switch first, or refuse. The spawning itself lives in
// riotClient.js so this module stays loadable in plain node.

const FALLBACK_PATCHLINE = 'live';
const PRODUCT = 'valorant';

// A patchline ends up as a launcher flag value, so it is clamped to the
// character set real patchline names use. The value comes from a file on disk,
// and an unclamped one could append flags of its own choosing to the
// launcher's command line.
function safePatchline(value) {
  const cleaned = String(value ?? '').replace(/[^a-z0-9]/gi, '');
  return cleaned || FALLBACK_PATCHLINE;
}

// RiotClientInstalls.json maps every installed product directory to the client
// that owns it, and that directory's last segment IS the patchline
// ("E:/Riot Games/VALORANT/live/" -> "live"). Read it rather than assuming
// 'live', because a PBE install sits beside it under a different patchline.
//
// Match a whole path SEGMENT, not a substring: a folder named
// "VALORANT-BACKUP" is not the product directory, and reading it as one would
// hand the launcher a patchline invented from an unrelated folder name.
export function valorantPatchline(installs) {
  for (const directory of Object.keys(installs?.associated_client ?? {})) {
    const segments = String(directory).split(/[\\/]+/).filter(Boolean);
    const index = segments.findIndex((segment) => segment.toLowerCase() === PRODUCT);
    if (index !== -1) return safePatchline(segments[index + 1]);
  }
  return FALLBACK_PATCHLINE;
}

// The launcher's own Play button resolves to exactly this: the client, told
// which product and patchline to start. Spawning the game's executable by hand
// skips the handshake, the patchline and the anti-cheat context the client
// sets up around it.
export function buildLaunchArgs({ product = PRODUCT, patchline = FALLBACK_PATCHLINE } = {}) {
  return [`--launch-product=${product}`, `--launch-patchline=${safePatchline(patchline)}`];
}

// What a PLAY press means for one account.
//
// Launching goes through Riot Client, and the client accepts a launch request long before
// it is willing to act on one: while the account is not signed in it starts restoring the
// session and asks the user to confirm a region, then drops the launch. A real press on a
// non-signed-in row opened the client window and never started the game, so PLAY is now
// launch-only — switching is its own explicit action, and the UI disables PLAY until the
// account is the one signed in.
export function planPlay({ isActive, valorantRunning }) {
  if (!isActive) return 'not-signed-in';
  return valorantRunning ? 'already-running' : 'launch';
}
