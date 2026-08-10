import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

function clientExecutable() {
  return path.join(process.env.SystemDrive ?? 'C:', 'Riot Games', 'Riot Client', 'RiotClientServices.exe');
}

export async function launchRiotClient() {
  const executable = clientExecutable();
  await fs.access(executable);
  const client = spawn(executable, [], { detached: true, stdio: 'ignore' });
  client.unref();
}
