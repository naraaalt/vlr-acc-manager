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
function accountId(label) { return createHash('sha256').update(label.toLocaleLowerCase()).digest('hex').slice(0, 24); }
async function ensureStorage() { await fs.mkdir(storageDirectory(), { recursive: true }); }
async function writeEncrypted(file, value) {
  assertEncryption();
  const encrypted = safeStorage.encryptString(JSON.stringify(value));
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, encrypted);
  await fs.rename(temporary, file);
}
async function readEncrypted(file, fallback) {
  try {
    assertEncryption();
    const encrypted = await fs.readFile(file);
    return JSON.parse(safeStorage.decryptString(encrypted));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Unable to decrypt saved account data: ${error.message}`);
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
      if (error.code === 'ENOENT') throw new Error(`Riot Client session data is missing: ${relativePath}. Start and sign in to Riot Client first.`);
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
