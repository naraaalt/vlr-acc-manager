import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { buildLaunchArgs, valorantPatchline } from './play.js';

const exec = promisify(execFile);

function clientExecutable() {
  return path.join(process.env.SystemDrive ?? 'C:', 'Riot Games', 'Riot Client', 'RiotClientServices.exe');
}

// RiotClientInstalls.json is a plain map of installed products to the client
// that owns them. It is the only place on the machine that says which
// patchline Valorant was installed under, so it is read rather than assumed —
// a PBE install has its own entry.
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

// The launcher's own Play button, in one call. Neither the game's executable
// nor its path is involved: the client resolves the product, the patchline and
// the anti-cheat context from the arguments below. Spawning the game by hand
// would skip all three.
export async function launchValorant() {
  await spawnClient(buildLaunchArgs({ patchline: await resolvePatchline() }));
}

// Whether the game is open right now. Used to refuse a second launch rather
// than to detect anything about the account.
export async function isValorantRunning() {
  try {
    const { stdout } = await exec('tasklist', ['/FI', 'IMAGENAME eq VALORANT.exe', '/NH']);
    return /VALORANT\.exe/i.test(stdout);
  } catch { return false; }
}
