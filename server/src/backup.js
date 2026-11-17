import { backup } from 'node:sqlite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import { openDatabase } from './database.js';
const databaseFile =
  process.env.DATABASE_PATH || fileURLToPath(new URL('../data/edubridge.sqlite', import.meta.url));
if (!existsSync(databaseFile)) throw new Error('Database does not exist; no backup created.');
const folder = process.env.BACKUP_PATH
  ? dirname(resolve(process.env.BACKUP_PATH))
  : resolve(process.env.BACKUP_DIR || './data/backups');
mkdirSync(folder, { recursive: true });
const file = process.env.BACKUP_PATH
  ? resolve(process.env.BACKUP_PATH)
  : resolve(folder, `edubridge-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
if (existsSync(file)) throw new Error('Backup target already exists');
const db = openDatabase();
try {
  await backup(db, file);
  console.log('Consistent SQLite backup created: ' + file);
} finally {
  db.close();
}
