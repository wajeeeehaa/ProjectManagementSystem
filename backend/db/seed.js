import { eq } from 'drizzle-orm';
import { db, pool } from './database.js';
import { roles } from './schema/index.js';

if (!db || !pool) {
  console.error('[db] DATABASE_URL is empty');
  process.exit(1);
}

// Workspace Owner, Admin, and Member roles are membership records, not global account roles.
await db.insert(roles).values({ title: 'user' }).onConflictDoNothing({ target: roles.title });

const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.title, 'user')).limit(1);
if (!role) {
  console.error('[db] default user role was not created');
  process.exit(1);
}

await pool.end();
console.log('[db] default user role is present');
