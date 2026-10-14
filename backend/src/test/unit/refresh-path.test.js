import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import request from 'supertest';
import { pool } from '../../../db/database.js';
import app from '../../app.js';

describe('refresh route path', () => {
  after(async () => {
    await pool?.end();
  });

  it('does not treat a trailing slash as the refresh endpoint', async () => {
    const exact = await request(app).post('/api/auth/refresh-token');
    const slashed = await request(app).post('/api/auth/refresh-token/');

    assert.equal(exact.status, 401);
    assert.equal(slashed.status, 404);

    const me = await request(app).get('/api/auth/me');
    const login = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: 'short' });
    assert.equal(me.status, 401);
    assert.equal(login.status, 400);
  });
});
