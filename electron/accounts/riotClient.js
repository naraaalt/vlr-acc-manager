import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { promisify } from 'node:util';
import { readLockfile } from '../riot/lockfile.js';
import { launchRequestPath, LAUNCH_APPEAR_TIMEOUT, LAUNCH_RETRY_DELAYS, valorantPatchline } from './play.js';
import { clientCandidates, conventionalClientPath, protocolExecutable, registryCommand, uniqueClients } from './riotClientPath.js';

const exec = promisify(execFile);

// Riot Client serves its own API over 127.0.0.1 with a self-signed certificate.
const localAgent = new https.Agent({ rejectUnauthorized: false });

// RiotClientInstalls.json is a plain map of installed products to the client that owns
// them. It is the only place on the machine that says which patchline Valorant was
// installed under, so it is read rather than assumed — a PBE install has its own entry.
// It is also one of the two records that name the client's own location.
function installsPath() {
  const programData = process.env.ProgramData ?? path.join(process.env.SystemDrive ?? 'C:', 'ProgramData');
  return path.join(programData, 'Riot Games', 'RiotClientInstalls.json');
}

async function readInstalls() {
  try { return JSON.parse(await fs.readFile(installsPath(), 'utf8')); }
  catch { return null; }
}

async function resolvePatchline() {
  return valorantPatchline(await readInstalls());
}

// Windows' own record of where the client lives: the handler for the `riotclient://`
// protocol. Read on top of the install map because that map can be missing or stale — on a
// machine that has not run an update since the client was moved, this is the only place
// that still knows, and it is the one Windows itself uses to open the client.
async function registeredClientPath() {
  try {
    const { stdout } = await exec('reg', ['query', 'HKEY_CLASSES_ROOT\\riotclient\\shell\\open\\command', '/ve']);
    return protocolExecutable(registryCommand(stdout));
  } catch { return null; }
}

// Every place this machine might have put RiotClientServices.exe, most authoritative first.
export async function clientExecutableCandidates() {
  const [installs, registered] = await Promise.all([readInstalls(), registeredClientPath()]);
  return uniqueClients([
    ...clientCandidates(installs),
    registered,
    conventionalClientPath(process.env.SystemDrive)
  ]);
}

// The first candidate that is actually on disk, or null. Exported so a harness can prove the
// order with files it creates on any drive, without touching a real Riot install.
export async function firstExisting(candidates) {
  for (const candidate of candidates ?? []) {
    try { await fs.access(candidate); return candidate; } catch { /* not this one */ }
  }
  return null;
}

// Riot Client is not required to live on the system drive, so its location is discovered
// rather than assumed, and the failure below says what was looked at. The old code composed
// C:\Riot Games\Riot Client\RiotClientServices.exe, which made every machine that installed
// the client elsewhere permanently unusable while reporting the miss as a missing file.
async function resolveClientExecutable() {
  const candidates = await clientExecutableCandidates();
  const found = await firstExisting(candidates);
  if (found) return found;
  throw new Error(`Riot Client was not found on this PC. Looked in ${candidates.length} place(s): ${candidates.join(' · ')}. Install Riot Client, or start it once so Windows records where it lives.`);
}

// Both entries go through here so the client is located in exactly one place.
async function spawnClient(args) {
  const executable = await resolveClientExecutable();
  const client = spawn(executable, args, { detached: true, stdio: 'ignore' });
  client.unref();
}

export async function launchRiotClient() {
  await spawnClient([]);
}

// Starts Valorant by asking the RUNNING client, over the local API its own Play button
// uses. This is deliberate and load-bearing — see launchRequestPath in play.js for why
// passing the launcher `--launch-product` does not work: that path is an app command
// gated behind Riot's direct-launch opt-in, which is disabled on this build, and the
// attempt it makes loses a process-singleton race and exits without starting anything.
//
// The lockfile carries the port and the password for this session, so the request is
// authorised with the same basic-auth scheme the client's other local endpoints use.
// Nothing here is hardcoded about the game's install location: the route names the
// product and patchline and the client resolves the rest.
//
// Not exported: one request is not a launch. Callers want launchValorantWhenReady, which
// keeps asking until the game is actually up.
async function launchValorant() {
  const lockfile = await readLockfile();
  const requestPath = launchRequestPath({ patchline: await resolvePatchline() });
  const authorization = Buffer.from(`riot:${lockfile.password}`).toString('base64');

  return await new Promise((resolve, reject) => {
    const request = https.request({
      hostname: '127.0.0.1',
      port: lockfile.port,
      path: requestPath,
      method: 'POST',
      agent: localAgent,
      headers: {
        Authorization: `Basic ${authorization}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength('{}')
      }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8').trim();
        if (response.statusCode >= 200 && response.statusCode < 300) resolve({ status: response.statusCode, body });
        else reject(new Error(`Riot Client refused the launch (${response.statusCode})${body ? `: ${body}` : '.'}`));
      });
    });
    request.on('error', (error) => reject(new Error(`Could not reach Riot Client to launch the game: ${error.message}`, { cause: error })));
    request.setTimeout(20_000, () => request.destroy(new Error('Riot Client did not answer the launch request within 20 seconds.')));
    request.end('{}');
  });
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForValorantProcess(timeoutMs) {
  const started = Date.now();
  for (;;) {
    if (await isValorantRunning()) return true;
    if (Date.now() - started >= timeoutMs) return false;
    await sleep(750);
  }
}

// Ask the client for a launch and keep asking until the game is actually running.
//
// One request is not enough, and this wrapper exists for exactly that: the client accepts a
// launch request and then drops it while its own lifecycle is still settling — region
// election, EULA, client config, Vanguard health check — which is precisely the window just
// after a switch. A single request that returns 200 and produces nothing is the failure this
// is written to stop reporting as a success, so the verdict here is the game PROCESS, never
// the response code.
export async function launchValorantWhenReady({
  delays = LAUNCH_RETRY_DELAYS,
  appearTimeout = LAUNCH_APPEAR_TIMEOUT
} = {}) {
  const refusals = [];
  for (const delay of delays) {
    if (delay) await sleep(delay);
    try { await launchValorant(); }
    catch (error) { refusals.push(error.message); continue; }
    if (await waitForValorantProcess(appearTimeout)) return true;
  }
  const last = refusals[refusals.length - 1];
  throw new Error(last
    ? `Riot Client would not start the game: ${last}`
    : 'Riot Client accepted the launch request but Valorant never started. Try PLAY again, or press Play in the Riot Client.');
}

// Whether the game is open right now. Used to refuse a second launch rather than to
// detect anything about the account.
export async function isValorantRunning() {
  try {
    const { stdout } = await exec('tasklist', ['/FI', 'IMAGENAME eq VALORANT.exe', '/NH']);
    return /VALORANT\.exe/i.test(stdout);
  } catch { return false; }
}
