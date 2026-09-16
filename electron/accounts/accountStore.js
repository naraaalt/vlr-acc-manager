import { app, safeStorage } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const RIOT_CLIENT_ROOT = path.join(process.env.LOCALAPPDATA ?? '', 'Riot Games', 'Riot Client');
// Riot's current Windows client keeps session state across the full Data and
// Config directories (file names vary between client releases). The lockfile
// is deliberately excluded because its port/password is always live-only.
const SOURCES = [['Data', true], ['Config', true]];

function storageDirectory() { return path.join(app.getPath('userData'), 'accounts'); }
function indexPath() { return path.join(storageDirectory(), 'index.vam'); }
function encryptedPath(id) { return path.join(storageDirectory(), `${id}.vam`); }
function assertEncryption() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is unavailable. Account storage is disabled to protect your Riot session data.');
}
function normaliseLabel(label) {
  const value = String(label ?? '').trim();
  if (!value || value.length > 64) throw new Error('Account labels must be between 1 and 64 characters.');
  return value;
}
// toLowerCase() deliberately, NOT toLocaleLowerCase(): this id becomes the
// account's filename and is embedded in the index, so it may depend only on
// the label text. Locale-aware casing resolves 'MAIN' to a different id on a
// Turkish-configured machine ('I' lowercases to a dotless 'ı'), and the saved
// account would then read as missing on that machine.
function accountId(label) { return createHash('sha256').update(label.toLowerCase()).digest('hex').slice(0, 24); }
async function ensureStorage() { await fs.mkdir(storageDirectory(), { recursive: true }); await sweepStaleTempFiles(); }

// Windows refuses a rename for a moment while an antivirus scan or the search
// indexer holds a handle to the file, and a whole write is exactly one rename.
// Retrying briefly turns that transient refusal into a successful save instead
// of an EPERM the user has to resolve by hand.
const RENAME_RETRY_DELAYS_MS = [50, 200, 600];
const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
function sleep(milliseconds) { return new Promise((resolve) => { setTimeout(resolve, milliseconds); }); }

async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      if (!RETRYABLE_RENAME_CODES.has(error.code) || attempt >= RENAME_RETRY_DELAYS_MS.length) throw error;
      await sleep(RENAME_RETRY_DELAYS_MS[attempt]);
    }
  }
}

// A write killed between its temp file and the rename leaves that temp file
// behind for good — earlier failures had left 13 MB of them in the accounts
// directory. Sweep once per run, and only files old enough that no write still
// in flight could own them.
const STALE_TEMP_MS = 5 * 60 * 1000;
let sweptStaleTemps = false;
async function sweepStaleTempFiles() {
  if (sweptStaleTemps) return 0;
  sweptStaleTemps = true;
  let entries;
  try { entries = await fs.readdir(storageDirectory()); }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  const cutoff = Date.now() - STALE_TEMP_MS;
  let removed = 0;
  for (const name of entries) {
    if (!name.endsWith('.tmp')) continue;
    const file = path.join(storageDirectory(), name);
    try {
      if ((await fs.stat(file)).mtimeMs > cutoff) continue;
      await fs.rm(file, { force: true });
      removed += 1;
    } catch { /* already gone, or not ours to remove */ }
  }
  if (removed) console.log(`Removed ${removed} leftover temporary account file(s).`);
  return removed;
}

async function writeEncrypted(file, value) {
  assertEncryption();
  const encrypted = safeStorage.encryptString(JSON.stringify(value));
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, encrypted);
  try {
    await renameWithRetry(temporary, file);
  } catch (error) {
    // Never leave the temp file behind: it holds an encrypted copy of the
    // account and nothing would ever collect it. The original code and message
    // are kept so the failure still classifies as a file-system error.
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw new Error(`Unable to write "${path.basename(file)}": ${error.message}`, { cause: error });
  }
}
async function readEncrypted(file, fallback) {
  try {
    assertEncryption();
    const encrypted = await fs.readFile(file);
    return JSON.parse(safeStorage.decryptString(encrypted));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Unable to decrypt saved account data: ${error.message}`, { cause: error });
  }
}
async function readIndex() { return readEncrypted(indexPath(), []); }
async function writeIndex(index) { await ensureStorage(); await writeEncrypted(indexPath(), index); }
async function listFiles(root, logicalRoot) {
  const output = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const physical = path.join(root, entry.name);
    const logical = path.posix.join(logicalRoot, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(physical, logical));
    else if (entry.name === 'lockfile') continue;
    else if (entry.isFile()) output.push({ path: logical, content: (await fs.readFile(physical)).toString('base64') });
  }
  return output;
}

export function getRiotClientRoot() { return RIOT_CLIENT_ROOT; }

export async function captureLiveCredentials() {
  const files = [];
  for (const [relativePath, directory] of SOURCES) {
    const source = path.join(RIOT_CLIENT_ROOT, relativePath);
    try {
      if (directory) files.push(...await listFiles(source, relativePath));
      else files.push({ path: relativePath, content: (await fs.readFile(source)).toString('base64') });
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Riot Client session data is missing: ${relativePath}. Start and sign in to Riot Client first.`, { cause: error });
      throw error;
    }
  }
  return { version: 1, files };
}

export async function saveAccount(label, credentials, metadata = {}) {
  const name = normaliseLabel(label);
  if (!credentials?.files?.length) throw new Error('No Riot Client session files were captured.');
  await ensureStorage();
  const id = accountId(name);
  const index = await readIndex();
  const now = new Date().toISOString();
  const entry = {
    label: name,
    id,
    savedAt: now,
    lastCheckedAt: metadata.lastCheckedAt ?? now,
    accountName: metadata.accountName ?? null,
    puuid: metadata.puuid ?? null
  };
  const existing = index.findIndex((account) => account.id === id);
  if (existing >= 0) index[existing] = {
    ...index[existing],
    ...entry,
    accountName: entry.accountName ?? index[existing].accountName ?? null,
    puuid: entry.puuid ?? index[existing].puuid ?? null
  };
  else index.push(entry);
  await writeEncrypted(encryptedPath(id), { credentials, apiSession: metadata.apiSession ?? null });
  await writeIndex(index);
  return entry;
}

export async function loadAccount(label) {
  const name = normaliseLabel(label);
  const id = accountId(name);
  const entry = (await readIndex()).find((account) => account.id === id);
  if (!entry) throw new Error(`Saved account "${name}" was not found.`);
  return { ...entry, ...(await readEncrypted(encryptedPath(id))) };
}

export async function listAccounts() {
  return (await readIndex()).sort((a, b) => new Date(b.lastCheckedAt) - new Date(a.lastCheckedAt));
}

export async function deleteAccount(label) {
  const name = normaliseLabel(label);
  const id = accountId(name);
  const index = await readIndex();
  if (!index.some((account) => account.id === id)) throw new Error(`Saved account "${name}" was not found.`);
  await fs.rm(encryptedPath(id), { force: true });
  await writeIndex(index.filter((account) => account.id !== id));
}

// Renaming migrates the account id (sha256 of the label) everywhere it is
// referenced: the encrypted blob filename, the index entry, and — when the
// renamed account is the live one — the VamAccountId marker the switcher
// wrote into the Riot Client root.
export async function renameAccount(oldLabel, newLabel) {
  const from = normaliseLabel(oldLabel);
  const to = normaliseLabel(newLabel);
  const id = accountId(from);
  const nextId = accountId(to);
  const index = await readIndex();
  const entry = index.find((account) => account.id === id);
  if (!entry) throw new Error(`Saved account "${from}" was not found.`);
  if (to !== from && index.some((account) => account.id === nextId && account.id !== id)) {
    throw new Error(`An account named "${to}" already exists.`);
  }
  if (to === from) return;
  await ensureStorage();
  await fs.rm(encryptedPath(nextId), { force: true });
  await renameWithRetry(encryptedPath(id), encryptedPath(nextId));
  await writeIndex(index.map((account) => account.id === id ? { ...account, label: to, id: nextId } : account));
  if (await getActiveAccountId() === id) {
    await fs.writeFile(path.join(RIOT_CLIENT_ROOT, 'VamAccountId.instance'), nextId, 'utf8');
  }
}

export async function updateAccountSession(label, apiSession) {
  const account = await loadAccount(label);
  await writeEncrypted(encryptedPath(account.id), { credentials: account.credentials, apiSession });
  const index = await readIndex();
  const next = index.map((entry) => entry.id === account.id ? { ...entry, lastCheckedAt: new Date().toISOString() } : entry);
  await writeIndex(next);
}

export async function getActiveAccountId() {
  try { return (await fs.readFile(path.join(RIOT_CLIENT_ROOT, 'VamAccountId.instance'), 'utf8')).trim() || null; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export const managedPaths = SOURCES.map(([relativePath]) => relativePath);
