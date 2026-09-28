import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
const directory = process.env.GARDEN_DATA_DIR;
const destination = process.argv[2];
if (!directory || !destination) throw new Error('Usage: GARDEN_DATA_DIR=/var/lib/garden node server/backup.mjs /private/backup/garden-YYYYMMDD.sqlite');
const source = join(resolve(directory), 'garden.sqlite');
const target = resolve(destination);
if (!existsSync(source) || existsSync(target)) throw new Error('Source must exist and destination must be a new file');
process.umask(0o077);
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(source);
try {
  db.exec('PRAGMA busy_timeout=10000');
  db.prepare('VACUUM INTO ?').run(target);
  chmodSync(target, 0o600);
  const backup = new DatabaseSync(target, { readOnly: true });
  try { if (backup.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Backup integrity check failed'); }
  finally { backup.close(); }
} finally { db.close(); }
