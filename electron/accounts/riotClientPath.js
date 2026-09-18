// Where is RiotClientServices.exe? Pure path plumbing for answering that.
//
// A Riot Client install is not required to live on the system drive, and assuming
// C:\Riot Games\Riot Client means a machine that put it on D: or E: can never be driven by
// this app — while the failure it produces ("ENOENT ... access 'C:\Riot Games\...'") reads
// like a file lock, so the one thing that would explain it is the thing it never says.
//
// Two records on the machine name the real location, and both are read here:
//
//   - RiotClientInstalls.json, which Riot rewrites on every install and update, mapping each
//     installed product to the client that owns it (plus rc_default / rc_live for the client
//     itself). This is the same file the patchline comes from.
//   - the `riotclient://` protocol handler in the registry, which Windows itself uses to open
//     the client, so it points at the executable wherever the user put it.
//
// The conventional location is kept as a last resort only. Everything here is text work —
// no disk access at all — so the decision is unit-tested rather than discovered on a user's
// machine; the caller probes the candidates in order and keeps the first that exists.
import path from 'node:path';

const CLIENT_FILENAME = 'RiotClientServices.exe';

function isClientExecutable(value) {
  return typeof value === 'string' && value.trim().toLowerCase().endsWith(CLIENT_FILENAME.toLowerCase());
}

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const value of list) {
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

// Filtered to the executable we are actually going to spawn, and deduplicated keeping the
// first spelling. Exported because the caller merges candidates from two independent records
// that routinely name the same file, and the error message lists them.
export function uniqueClients(values) {
  return unique((Array.isArray(values) ? values : []).filter(isClientExecutable));
}

// Candidates from RiotClientInstalls.json, most authoritative first: the two entries that
// name the client itself, then the client each installed product is mapped to. Values that
// are not RiotClientServices.exe are dropped — `associated_client` maps a product to
// whichever client owns it, and a value pointing at some other executable is not the thing
// to spawn.
export function clientCandidates(installs) {
  if (!installs || typeof installs !== 'object') return [];
  return uniqueClients([
    installs.rc_default,
    installs.rc_live,
    ...Object.values(installs.associated_client ?? {}),
    ...Object.values(installs.patchlines ?? {})
  ]);
}

// The value out of `reg query <key> /ve`, whose output is one line per value:
//     (Default)    REG_SZ    "C:\Riot Games\Riot Client\RiotClientServices.exe" --app-command="%1"
// REG_EXPAND_SZ is accepted too: it would hold the same shape with %VARS% in it.
export function registryCommand(output) {
  const match = /REG_(?:EXPAND_)?SZ\s+(\S.*?)\s*$/m.exec(String(output ?? ''));
  return match ? match[1] : null;
}

// The executable out of that command line: a quoted path followed by arguments. Quoting is
// the convention rather than a guarantee, so an unquoted one falls back to everything up to
// the executable's own name. Anything that is not the client is refused rather than returned
// — a handler pointing somewhere unexpected must not become the thing this app runs.
export function protocolExecutable(command) {
  const text = String(command ?? '').trim();
  if (!text) return null;
  const quoted = /^"([^"]+)"/.exec(text);
  if (quoted) return isClientExecutable(quoted[1]) ? quoted[1].trim() : null;
  const bare = /^(.+?RiotClientServices\.exe)/i.exec(text);
  return bare ? bare[1].trim() : null;
}

// Last resort: the conventional location on the system drive. Still where most installs
// land, and only reached when neither record above resolved to a file that exists.
export function conventionalClientPath(systemDrive) {
  const drive = String(systemDrive ?? '').trim() || 'C:';
  return path.join(drive, 'Riot Games', 'Riot Client', CLIENT_FILENAME);
}
