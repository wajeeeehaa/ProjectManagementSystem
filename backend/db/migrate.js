import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './database.js';

if (!db || !pool) {
  console.error('[db] DATABASE_URL is empty');
  process.exit(1);
}

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

await migrate(db, { migrationsFolder });
await pool.end();
console.log('[db] migrations applied');
