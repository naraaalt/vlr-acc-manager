import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

// Modul ini juga bebas 'electron': yang butuh process.execPath / pid menerimanya sebagai
// parameter, jadi tesnya bisa jalan di Node biasa.

export function buildInstallerArgs(installDir) {
  const args = ['/S'];
  // NSIS: /D= harus parameter terakhir dan TIDAK boleh dikutip, spasi boleh.
  if (installDir) args.push(`/D=${installDir}`);
  return args;
}

export function helperPath(scratchRoot) {
  return path.join(scratchRoot, 'sapphire-update', 'apply-update.cjs');
}

// Helper-nya DI-GENERATE, jadi ia harus ditulis ke disk sebelum ada yang mencoba menjalankannya.
// Ini pernah terlewat: runUpdateHelper men-spawn path helper tanpa ada apa pun yang menulisnya,
// jadi Electron dijalankan sebagai Node dengan path yang tidak ada, keluar seketika, dan karena
// stdio-nya sengaja diabaikan tidak ada pesan apa pun — gejalanya cuma "app menutup, versi tidak
// berubah".
export function writeHelper(scratchRoot) {
  const helper = helperPath(scratchRoot);
  mkdirSync(path.dirname(helper), { recursive: true });
  writeFileSync(helper, buildHelperSource(), 'utf8');
  return helper;
}

// Helper dijalankan oleh Electron-nya SENDIRI dengan ELECTRON_RUN_AS_NODE=1 — jadi tidak butuh
// Node/python/runtime lain di mesin user, dan tidak lewat cmd.exe (yang bikin masalah quoting).
export function buildHelperSource() {
  return `// Di-generate oleh Sapphire. Node builtin saja.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const [installer, installDir, exePath, parentPidRaw, dryRun] = process.argv.slice(2);
const parentPid = Number(parentPidRaw);
const logPath = path.join(path.dirname(installer), 'update.log');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => {
  try { fs.appendFileSync(logPath, new Date().toISOString() + ' ' + message + '\\n'); } catch {}
};

(async () => {
  log('helper start pid=' + process.pid + ' waiting for ' + parentPid + ' dryRun=' + dryRun);
  // Installer tidak bisa menimpa Sapphire.exe selagi app jalan, jadi tunggu app benar-benar mati.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { process.kill(parentPid, 0); } catch { break; }
    await sleep(500);
  }
  log('parent gone, installing');

  if (dryRun === 'true') {
    log('dry run: not running the installer');
    fs.writeFileSync(path.join(path.dirname(installer), 'dry-run-marker.txt'), 'helper ran\\n');
    return;
  }

  const args = ['/S'];
  if (installDir) args.push('/D=' + installDir);
  const child = spawn(installer, args, { stdio: 'ignore' });
  await new Promise((resolve) => child.on('exit', (code) => { log('installer exit ' + code); resolve(); }));

  if (fs.existsSync(exePath)) {
    log('relaunching ' + exePath);
    // ELECTRON_RUN_AS_NODE harus DILEPAS sebelum menjalankan app, dan ini bukan kehati-hatian
    // teoretis: helper ini dijalankan DENGAN variabel itu diset 1, proses anak mewarisi seluruh
    // environment, jadi Sapphire bangun sebagai Node biasa tanpa script — keluar seketika tanpa
    // jendela dan tanpa pesan. Gejalanya: update selesai, versi di disk sudah baru, app tidak
    // pernah muncul lagi. Dibuktikan dengan spawn dua kali, bedanya hanya variabel ini:
    // 0 proses vs 4 proses.
    const cleanEnv = Object.assign({}, process.env);
    delete cleanEnv.ELECTRON_RUN_AS_NODE;
    spawn(exePath, [], { detached: true, stdio: 'ignore', env: cleanEnv }).unref();
  } else {
    log('exe missing after install: ' + exePath);
  }
})().catch((error) => log('helper failed: ' + (error && error.stack)));
`;
}

/**
 * Jalankan helper lalu keluar dari app. Pemanggil yang bertanggung jawab memanggil app.quit().
 */
export function runUpdateHelper({ scratchRoot, installerPath: installer, installDir, exePath, pid, electronPath, dryRun = false }) {
  const helper = writeHelper(scratchRoot);
  // ELECTRON_RUN_AS_NODE: binary Electron yang sudah terpasang dijalankan sebagai Node biasa.
  const child = spawn(electronPath, [
    helper, installer, installDir ?? '', exePath, String(pid), String(dryRun)
  ], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });
  child.unref();
  return child.pid;
}