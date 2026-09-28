import { mkdirSync, chmodSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = resolve(process.env.GARDEN_DATA_DIR || '/var/lib/garden');
const backupDir = join(dataDir, 'backups');
process.umask(0o077);
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
chmodSync(backupDir, 0o700);
const now = new Date();
const timestamp = now.toISOString().replace(/[-:.]/g, '');
const target = join(backupDir, `garden-${timestamp}.sqlite`);
// The child performs both consistent backup and integrity verification. Retain
// old copies on any error; cleanup runs only after a successful new backup.
execFileSync(process.execPath, [fileURLToPath(new URL('./backup.mjs', import.meta.url)), target], {
  env: { ...process.env, GARDEN_DATA_DIR: dataDir },
  stdio: 'pipe',
});
const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
for (const entry of readdirSync(backupDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const match = /^garden-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z\.sqlite$/.exec(entry.name);
  if (!match) continue;
  const [, year, month, day, hour, minute, second, millis] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.${millis}Z`;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== iso) continue;
  if (date.getTime() < cutoff) unlinkSync(join(backupDir, entry.name));
}
