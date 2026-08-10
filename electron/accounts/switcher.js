import { app, safeStorage } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { captureLiveCredentials, getRiotClientRoot, loadAccount, managedPaths } from './accountStore.js';
import { refreshSwitchedAccount } from './accountService.js';
import { launchRiotClient } from './riotClient.js';

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
    catch (error) { if (!/not found|no running instance/i.test(`${error.stdout} ${error.stderr}`)) throw new Error(`Could not close ${name}: ${error.message}`); }
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
async function backupLiveCredentials() {
  const backup = await captureLiveCredentials();
  await fs.mkdir(backupDirectory(), { recursive: true });
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is unavailable, so switching is disabled.');
  await fs.writeFile(path.join(backupDirectory(), `before-switch-${Date.now()}.vam`), safeStorage.encryptString(JSON.stringify(backup)));
}
export async function switchToAccount(label) {
  if (switchInProgress) throw new Error('Another account switch is still in progress. Wait for it to finish before switching again.');
  switchInProgress = true;
  try {
    const account = await loadAccount(label);
    await backupLiveCredentials();
    await closeRiotProcesses();
    await writeBundle(account.credentials);
    await fs.writeFile(path.join(riotRoot, 'VamAccountId.instance'), account.id, 'utf8');
    await launchRiotClient();
    const refreshed = await refreshSwitchedAccount(account.label);
    return { label: account.label, store: refreshed.store };
  } finally {
    switchInProgress = false;
  }
}
