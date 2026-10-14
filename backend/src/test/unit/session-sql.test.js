import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import { db, pool } from '../../../db/database.js';
import { refreshSessions } from '../../../db/schema/index.js';

describe('refresh session query', () => {
  after(async () => {
    await pool?.end();
  });

  it('locks the presented refresh-session row during rotation', () => {
    const query = db
      .select()
      .from(refreshSessions)
      .where(eq(refreshSessions.jtiHash, 'abc'))
      .limit(1)
      .for('update');

    assert.match(query.toSQL().sql, /for update/i);
  });
});
