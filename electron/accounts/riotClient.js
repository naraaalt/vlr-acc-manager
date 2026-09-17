import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { promisify } from 'node:util';
import { readLockfile } from '../riot/lockfile.js';
import { launchRequestPath, valorantPatchline } from './play.js';

const exec = promisify(execFile);

// Riot Client serves its own API over 127.0.0.1 with a self-signed certificate.
const localAgent = new https.Agent({ rejectUnauthorized: false });

function clientExecutable() {
  return path.join(process.env.SystemDrive ?? 'C:', 'Riot Games', 'Riot Client', 'RiotClientServices.exe');
}

// RiotClientInstalls.json is a plain map of installed products to the client that owns
// them. It is the only place on the machine that says which patchline Valorant was
// installed under, so it is read rather than assumed — a PBE install has its own entry.
function installsPath() {
  const programData = process.env.ProgramData ?? path.join(process.env.SystemDrive ?? 'C:', 'ProgramData');
  return path.join(programData, 'Riot Games', 'RiotClientInstalls.json');
}

async function resolvePatchline() {
  try { return valorantPatchline(JSON.parse(await fs.readFile(installsPath(), 'utf8'))); }
  catch { return valorantPatchline(null); }
}

// Both entries go through here so the client is located in exactly one place.
async function spawnClient(args) {
  const executable = clientExecutable();
  await fs.access(executable);
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
export async function launchValorant() {
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

// Whether the game is open right now. Used to refuse a second launch rather than to
// detect anything about the account.
export async function isValorantRunning() {
  try {
    const { stdout } = await exec('tasklist', ['/FI', 'IMAGENAME eq VALORANT.exe', '/NH']);
    return /VALORANT\.exe/i.test(stdout);
  } catch { return false; }
}
