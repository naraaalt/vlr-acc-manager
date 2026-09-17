// Pure decisions behind the PLAY control: which request starts the game, which patchline
// this machine actually has installed, and whether a press should launch or refuse. The
// HTTP call itself lives in riotClient.js so this module stays loadable in plain node.

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

// The client's own local API — the request its Play button makes: a POST to the
// product-launcher plugin for one product + patchline.
//
// Handing the launcher `--launch-product/--launch-patchline` is NOT equivalent, and that
// is the whole reason this exists. The client treats that as an "app command" (direct
// launch) and gates it behind Riot's direct-launch opt-in, which is disabled on this
// build; the attempt then restarts the client and loses a process-singleton race, so the
// game never starts. Pressing Play calls this route, and so do we.
export function launchRequestPath({ product = PRODUCT, patchline = FALLBACK_PATCHLINE } = {}) {
  return `/product-launcher/v1/products/${encodeURIComponent(product)}/patchlines/${safePatchline(patchline)}`;
}

// What a PLAY press means for one account.
//
// Launching goes through Riot Client, and the client only acts on a launch request while it
// is signed in — handed one while it is parked, it starts restoring the session instead and
// drops the launch. That is a fact about the client, not a reason to refuse the press. A
// switch is what makes it signed in, and this app already switches, so PLAY does it here:
// one press, switch then launch, and the user never sees the client window.
export function planPlay({ isActive, valorantRunning }) {
  if (isActive) return valorantRunning ? 'already-running' : 'launch';
  // Switching closes every Riot process on the way through, the game included. That is fine
  // when nothing is open, and it is a killed match when something is — a mis-click on
  // another row must not end a game in progress. Refuse and say so instead of deciding for
  // the user; the press costs one toast and no match.
  if (valorantRunning) return 'close-game-first';
  return 'switch-then-launch';
}

// Delays before each launch request, in milliseconds, first attempt included. More than one
// because the client can accept a request and then swallow it: right after a switch its own
// lifecycle is still running (region election, EULA, client config, Vanguard health check),
// and a launch that arrives in that window is acknowledged and dropped. Ascending so a
// client that is still busy is not hammered while it works.
export const LAUNCH_RETRY_DELAYS = [0, 2_000, 5_000, 9_000];

// How long to wait for the game process to appear after one accepted request. A launch that
// works produces VALORANT.exe in about three seconds; this leaves room without dragging out
// a retry.
export const LAUNCH_APPEAR_TIMEOUT = 6_000;
