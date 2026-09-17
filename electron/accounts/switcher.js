import { app, safeStorage } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { captureLiveCredentials, getRiotClientRoot, loadAccount, managedPaths } from './accountStore.js';
import { isAccountLive, refreshSwitchedAccount } from './accountService.js';
import { isValorantRunning, launchRiotClient, launchValorant } from './riotClient.js';
import { planPlay } from './play.js';

const exec = promisify(execFile);
const processes = ['LeagueClient.exe', 'LoR.exe', 'VALORANT.exe', 'RiotClientServices.exe', 'RiotClientUx.exe', 'RiotClientUxRender.exe'];
const riotRoot = getRiotClientRoot();
let switchInProgress = false;

function backupDirectory() { return path.join(app.getPath('userData'), 'switch-backups'); }
function assertWithinRiotRoot(target) {
  const relative = path.relative(riotRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe Riot Client path refused.');
}
async function closeRiotProcesses() {
  for (const name of processes) {
    try { await exec('taskkill', ['/F', '/IM', name]); }
    catch (error) { if (!/not found|no running instance/i.test(`${error.stdout} ${error.stderr}`)) throw new Error(`Could not close ${name}: ${error.message}`, { cause: error }); }
  }
}
async function writeBundle(credentials) {
  for (const relativePath of managedPaths) {
    const target = path.join(riotRoot, relativePath);
    assertWithinRiotRoot(target);
    await fs.rm(target, { recursive: true, force: true });
  }
  for (const file of credentials.files) {
    const target = path.join(riotRoot, file.path);
    assertWithinRiotRoot(target);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(file.content, 'base64'));
  }
}
async function backupLiveCredentials(prefix = 'before-switch') {
  const backup = await captureLiveCredentials();
  await fs.mkdir(backupDirectory(), { recursive: true });
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is unavailable, so switching is disabled.');
  await fs.writeFile(path.join(backupDirectory(), `${prefix}-${Date.now()}.vam`), safeStorage.encryptString(JSON.stringify(backup)));
}
async function clearLiveSession() {
  await writeBundle({ version: 1, files: [] });
  const marker = path.join(riotRoot, 'VamAccountId.instance');
  assertWithinRiotRoot(marker);
  await fs.rm(marker, { force: true });
}

export async function openRiotSignIn() {
  if (switchInProgress) throw new Error('Another account switch is still in progress. Wait for it to finish before adding an account manually.');
  switchInProgress = true;
  try {
    try { await backupLiveCredentials('before-manual-sign-in'); }
    catch (error) { if (!/session data is missing/i.test(error.message)) throw error; }
    await closeRiotProcesses();
    await clearLiveSession();
    await launchRiotClient();
  } finally {
    switchInProgress = false;
  }
}

// Shared body: the caller owns the re-entrancy flag so PLAY can switch without
// tripping the guard its own entry point sets.
async function performSwitch(label) {
  const account = await loadAccount(label);
  await backupLiveCredentials();
  await closeRiotProcesses();
  await writeBundle(account.credentials);
  await fs.writeFile(path.join(riotRoot, 'VamAccountId.instance'), account.id, 'utf8');
  await launchRiotClient();
  const refreshed = await refreshSwitchedAccount(account.label);
  return { label: account.label, store: refreshed.store };
}

export async function switchToAccount(label) {
  if (switchInProgress) throw new Error('Another account switch is still in progress. Wait for it to finish before switching again.');
  switchInProgress = true;
  try {
    return await performSwitch(label);
  } finally {
    switchInProgress = false;
  }
}

// PLAY: start the game for the account that is signed in right now.
//
// Launch-only, deliberately. The alternative — switch, then launch — does not work:
// Riot Client accepts the launch request but will not act on it until its own login and
// region election have finished, and a switch is exactly what restarts that cycle. A real
// press on another account opened the client and produced no game. So a press here either
// launches or refuses, and refusing is reported rather than papered over.
export async function playAccount(label) {
  if (switchInProgress) throw new Error('Another account switch is still in progress. Wait for it to finish before launching.');
  switchInProgress = true;
  try {
    const account = await loadAccount(label);
    const isActive = await isAccountLive(account);
    // Only worth asking whether the game is open when this account owns the running
    // session; otherwise the answer cannot change the outcome.
    const valorantRunning = isActive && await isValorantRunning();
    const decision = planPlay({ isActive, valorantRunning });
    if (decision === 'not-signed-in') {
      return { label: account.label, launched: false, reason: 'not-signed-in' };
    }
    if (decision === 'already-running') {
      return { label: account.label, launched: false, reason: 'already-running' };
    }
    await launchValorant();
    return { label: account.label, launched: true, reason: null };
  } finally {
    switchInProgress = false;
  }
}
