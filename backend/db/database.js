import '../src/utils/loadEnv.js';
import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL?.trim() ?? '';

export const pool = connectionString
  ? new Pool({ connectionString, connectionTimeoutMillis: 5000 })
  : null;

if (pool) {
  pool.on('error', (error) => {
    console.error('[db] pool error', error);
  });
}

export const db = pool ? drizzle(pool, { schema }) : null;

export default db;
