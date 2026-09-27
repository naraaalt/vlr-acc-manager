import { app, safeStorage } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { captureLiveCredentials, getRiotClientRoot, loadAccount, managedPaths } from './accountStore.js';
import { isAccountLive, refreshSwitchedAccount } from './accountService.js';
import { isValorantRunning, launchRiotClient, launchValorantWhenReady } from './riotClient.js';
import { planPlay } from './play.js';
import { backupsToPrune } from '../lib/housekeeping.js';

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
  await pruneBackups();
}

// A backup is written before EVERY switch and used to never be discarded: 27 files / 245 MB in three
// days. Deliberately best-effort — failing to clean up backups must not fail the switch,
// because that backup exists precisely to protect this operation, not the other way round.
async function pruneBackups() {
  try {
    const directory = backupDirectory();
    const entries = [];
    for (const name of await fs.readdir(directory)) {
      const info = await fs.stat(path.join(directory, name)).catch(() => null);
      if (info) entries.push({ name, mtimeMs: info.mtimeMs });
    }
    for (const name of backupsToPrune(entries)) await fs.rm(path.join(directory, name), { force: true }).catch(() => {});
  } catch { /* housekeeping is never fatal */ }
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

// Only performSwitch's post-launch refresh sets this, so a failure before the credentials are
// touched (loadAccount, backupLiveCredentials, writeBundle) stays a plain failure, never a move.
const hasMoved = (error) => error?.switchedAccountMoved === true;

// Shared body: the caller owns the re-entrancy flag so PLAY can switch without tripping the
// guard its own entry point sets.
//
// This function deliberately REJECTS when the post-launch refresh fails: PLAY's guarantee is that
// a switch waits for the new session to be readable, and swallowing the failure would let PLAY
// launch against a client possibly sitting at Riot's sign-in screen. switchToAccount converts that
// failure into a reported move; PLAY keeps the throw.
async function performSwitch(label) {
  const account = await loadAccount(label);
  await backupLiveCredentials();
  await closeRiotProcesses();
  await writeBundle(account.credentials);
  await fs.writeFile(path.join(riotRoot, 'VamAccountId.instance'), account.id, 'utf8');
  await launchRiotClient();
  // Past this point the session HAS moved: credentials written, client relaunched. The marker is
  // what lets switchToAccount tell this failure from one before the client was touched.
  try {
    const refreshed = await refreshSwitchedAccount(account.label);
    return { label: account.label, store: refreshed.store };
  } catch (error) {
    error.switchedAccountMoved = true;
    throw error;
  }
}

export async function switchToAccount(label) {
  if (switchInProgress) throw new Error('Another account switch is still in progress. Wait for it to finish before switching again.');
  switchInProgress = true;
  try {
    // The success shape carries `moved` too: the renderer gates the page retarget on it, so a
    // plain `{label, store}` would stop the page following the most common case — a switch that
    // works. `refreshError` is on both paths so the renderer never has to tell absent from null.
    const result = await performSwitch(label);
    return { ...result, moved: true, refreshError: null };
  } catch (error) {
    // Everything before the refresh IS the switch: credentials written, client relaunched. The
    // refresh can still legitimately fail (a slow sign-in runs past waitForCurrentAccount's 60s
    // window; a just-rotated session can be rejected), and reporting that as a failed switch left
    // the renderer on the PREVIOUS account's page while the session had moved. `moved` is what it
    // retargets on; `refreshError` warns on top; a failure BEFORE the relaunch still rejects.
    if (!hasMoved(error)) throw error;
    return { label, store: null, moved: true, refreshError: error.message || 'The account moved, but its store could not be read yet.' };
  } finally {
    switchInProgress = false;
  }
}

// PLAY: get this account into the game, in one press. If it is already signed in it just asks
// Riot Client to start the game; otherwise it switches first, and the switch waits for the new
// session to be readable before returning, so the launch is asked for as an account the client
// is actually signed in as. This replaced a launch-only rule that refused every other row: the
// answer to "a client that is not signed in accepts a launch and drops it" is to switch, not to
// refuse — a manager exists to hold the accounts you are not currently in, so a control that
// only works on the account already open is almost always off.
export async function playAccount(label) {
  if (switchInProgress) throw new Error('Another account operation is still in progress. Wait for it to finish before launching.');
  switchInProgress = true;
  try {
    const account = await loadAccount(label);
    const isActive = await isAccountLive(account);
    // Only worth asking whether the game is open when this account owns the running session;
    // otherwise the answer cannot change what happens next.
    const valorantRunning = isActive && await isValorantRunning();
    const decision = planPlay({ isActive, valorantRunning });
    if (decision === 'already-running') {
      return { label: account.label, launched: false, switched: false, reason: 'already-running' };
    }
    if (decision === 'close-game-first') {
      // Reported, not acted on: the switch would close the game open under the account signed in
      // now, and that is the user's call to make, not a mis-click's.
      return { label: account.label, launched: false, switched: false, reason: 'close-game-first' };
    }
    const switched = decision === 'switch-then-launch';
    if (switched) await performSwitch(account.label);
    // Reports success only once the game process is up: the client acknowledging a request is not
    // a game starting, and conflating the two made an earlier build report a launch that never happened.
    await launchValorantWhenReady();
    return { label: account.label, launched: true, switched, reason: null };
  } finally {
    switchInProgress = false;
  }
}
