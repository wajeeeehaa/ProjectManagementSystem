import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, beforeEach, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import request from 'supertest';
import { db, pool } from '../../../db/database.js';
import { permissions, refreshSessions, rolePermissions, roles, users, blacklistTokens } from '../../../db/schema/index.js';
import app from '../../app.js';
import { authorization } from '../../middlewares/authenticationMiddlewares.js';
import { rateLimitSettings, resetRateLimits } from '../../middlewares/rateLimit.middleware.js';
import { setEmailTransport } from '../../services/email.service.js';
import { cleanupExpiredAuthRecords } from '../../services/session.service.js';
import { HttpError } from '../../utils/httpError.js';

const PASSWORD = 'Str0ng!Pass';
const NEXT_PASSWORD = 'N3xt!Pass';
const sentEmails = [];
let databaseReady = false;

setEmailTransport({
  sendMail: async (message) => {
    sentEmails.push(message);
  },
});

const quoteIdent = (value) => {
  if (!/^[a-z0-9_]+$/.test(value)) throw new Error('Unsafe database name');
  return `"${value}"`;
};

const ensureTestDatabase = async () => {
  const url = new URL(process.env.DATABASE_URL);
  const databaseName = url.pathname.replace(/^\//, '');
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to use non-test database ${databaseName}`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 2000,
  });
  await client.connect();
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE ${quoteIdent(databaseName)}`);
  }
  await client.end();
};

const resetDatabase = async () => {
  await pool.query(
    'TRUNCATE blacklist_tokens, refresh_sessions, users, role_permissions, permissions, roles RESTART IDENTITY CASCADE',
  );
  await pool.query("INSERT INTO roles (title) VALUES ('user')");
};

const cookieLines = (response) => {
  const raw = response.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
};

const cookieLine = (response, name) => cookieLines(response).find((line) => line.startsWith(`${name}=`));

const cookieValue = (line) => line.split(';')[0].slice(line.indexOf('=') + 1);

const activationToken = () => {
  const message = sentEmails.at(-1);
  const match = message?.text?.match(/https?:\/\/\S+/);
  assert.ok(match, 'activation email should contain a link');
  return new URL(match[0]).searchParams.get('token');
};

const registerVerify = async (email) => {
  const created = await request(app).post('/api/auth/register').send({
    email,
    password: PASSWORD,
    firstName: 'Ada',
    lastName: 'Lovelace',
  });
  assert.equal(created.status, 201);
  assert.equal(JSON.stringify(created.body).includes(PASSWORD), false);
  const verified = await request(app).post(`/api/auth/verify/${encodeURIComponent(activationToken())}`);
  assert.equal(verified.status, 200);
};

const login = async (email, password = PASSWORD) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  const access = cookieLine(response, 'accessToken');
  const refresh = cookieLine(response, 'refreshToken');
  const csrf = cookieLine(response, 'csrfToken');
  return { response, access, refresh, csrf };
};

const dbTest = (name, fn) =>
  it(name, async (t) => {
    if (!databaseReady) {
      t.skip('PostgreSQL is not available');
      return;
    }
    await fn();
  });

before(async () => {
  try {
    await ensureTestDatabase();
    const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../migrations');
    await migrate(db, { migrationsFolder });
    databaseReady = true;
  } catch (error) {
    databaseReady = false;
    console.error('[test] PostgreSQL is not available:', error.message);
  }
});

beforeEach(async () => {
  sentEmails.length = 0;
  resetRateLimits();
  rateLimitSettings.max = 20;
  if (databaseReady) await resetDatabase();
});

after(async () => {
  await pool?.end();
});

dbTest('registers, verifies, and logs in with scoped cookies', async () => {
  const email = 'ada@example.com';
  await registerVerify(email);
  const unverified = await request(app).post('/api/auth/register').send({
    email: 'new@example.com',
    password: PASSWORD,
    firstName: 'New',
    lastName: 'User',
  });
  assert.equal(unverified.status, 201);
  const blocked = await request(app).post('/api/auth/login').send({ email: 'new@example.com', password: PASSWORD });
  assert.equal(blocked.status, 403);

  const duplicate = await request(app).post('/api/auth/register').send({
    email,
    password: PASSWORD,
    firstName: 'Ada',
    lastName: 'Lovelace',
  });
  assert.equal(duplicate.status, 409);

  const weak = await request(app).post('/api/auth/register').send({
    email: 'weak@example.com',
    password: 'password',
    firstName: 'Weak',
    lastName: 'User',
  });
  assert.equal(weak.status, 400);

  const session = await login(email);
  assert.equal(session.response.status, 200);
  assert.match(session.access, /Path=\/api(;|$)/);
  assert.match(session.access, /HttpOnly/);
  assert.match(session.refresh, /Path=\/api\/auth\/refresh-token(;|$)/);
  assert.match(session.csrf, /Path=\/(;|$)/);
  assert.doesNotMatch(session.csrf, /HttpOnly/);
  assert.equal(session.response.body.data.user.roleTitle, 'user');
  assert.equal(Object.hasOwn(session.response.body.data.user, 'passwordHash'), false);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Cookie', session.access.split(';')[0]);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.email, email);
});

dbTest('rotates refresh sessions and revokes the family when an old token is replayed', async () => {
  const email = 'refresh@example.com';
  await registerVerify(email);
  const first = await login(email);
  const rotated = await request(app)
    .post('/api/auth/refresh-token')
    .set('Cookie', `${first.refresh.split(';')[0]}; ${first.csrf.split(';')[0]}`)
    .set('X-CSRF-Token', cookieValue(first.csrf));
  assert.equal(rotated.status, 200);

  const missingCsrf = await request(app)
    .post('/api/auth/refresh-token')
    .set('Cookie', rotated.headers['set-cookie'].find((line) => line.startsWith('refreshToken=')).split(';')[0]);
  assert.equal(missingCsrf.status, 403);

  const bearer = await request(app)
    .post('/api/auth/refresh-token')
    .set('Authorization', `Bearer ${rotated.body.data.refreshToken}`);
  assert.equal(bearer.status, 200);

  const replay = await request(app)
    .post('/api/auth/refresh-token')
    .set('Authorization', `Bearer ${rotated.body.data.refreshToken}`);
  assert.equal(replay.status, 401);
  assert.equal(replay.body.message, 'Session is no longer valid');

  const afterReplay = await request(app)
    .post('/api/auth/refresh-token')
    .set('Authorization', `Bearer ${bearer.body.data.refreshToken}`);
  assert.equal(afterReplay.status, 401);

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  const sessions = await db.select().from(refreshSessions).where(eq(refreshSessions.userId, user.id));
  assert.ok(sessions.length >= 2);
  assert.ok(sessions.every((session) => session.revokedAt));
  await cleanupExpiredAuthRecords();
  const retained = await db.select().from(refreshSessions).where(eq(refreshSessions.userId, user.id));
  assert.equal(retained.length, sessions.length);
});

dbTest('deletes only expired blacklist and refresh-session rows', async () => {
  const email = 'cleanup@example.com';
  await registerVerify(email);
  const first = await login(email);
  const rotated = await request(app)
    .post('/api/auth/refresh-token-mobile')
    .send({ refreshToken: first.response.body.data.refreshToken });
  assert.equal(rotated.status, 200);

  const sessions = await db.select().from(refreshSessions);
  const replaced = sessions.find((session) => session.replacedAt);
  const active = sessions.find((session) => !session.replacedAt && !session.revokedAt);
  await db
    .update(refreshSessions)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(refreshSessions.id, replaced.id));
  await db.insert(blacklistTokens).values([
    { tokenHash: 'a'.repeat(64), expiresAt: new Date(Date.now() - 1000) },
    { tokenHash: 'b'.repeat(64), expiresAt: new Date(Date.now() + 60_000) },
  ]);

  await cleanupExpiredAuthRecords();
  const remainingSessions = await db.select().from(refreshSessions);
  const remainingBlacklist = await db.select().from(blacklistTokens);
  assert.deepEqual(remainingSessions.map((session) => session.id), [active.id]);
  assert.deepEqual(remainingBlacklist.map((row) => row.tokenHash), ['b'.repeat(64)]);
});

dbTest('logs out immediately and enforces session-bound CSRF', async () => {
  const email = 'logout@example.com';
  await registerVerify(email);
  const session = await login(email);
  const access = session.access.split(';')[0];
  const csrf = session.csrf.split(';')[0];

  const forged = await request(app)
    .post('/api/auth/logout')
    .set('Cookie', `${access}; csrfToken=forged-value`)
    .set('X-CSRF-Token', 'forged-value');
  assert.equal(forged.status, 403);
  const stillSignedIn = await request(app).get('/api/auth/me').set('Cookie', access);
  assert.equal(stillSignedIn.status, 200);

  const loggedOut = await request(app)
    .post('/api/auth/logout')
    .set('Cookie', `${access}; ${csrf}`)
    .set('X-CSRF-Token', cookieValue(session.csrf));
  assert.equal(loggedOut.status, 200);
  assert.match(cookieLine(loggedOut, 'accessToken'), /Max-Age=0/);
  assert.match(cookieLine(loggedOut, 'refreshToken'), /Path=\/api\/auth\/refresh-token/);
  assert.match(cookieLine(loggedOut, 'csrfToken'), /Path=\/(;|$)/);

  const denied = await request(app).get('/api/auth/me').set('Cookie', access);
  assert.equal(denied.status, 401);

  const bearerLogin = await login(email);
  const bearerLogout = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${bearerLogin.response.body.data.accessToken}`);
  assert.equal(bearerLogout.status, 200);
});

dbTest('revokes every refresh family when the password changes or is reset', async () => {
  const email = 'password@example.com';
  await registerVerify(email);
  const first = await login(email);
  const second = await login(email);
  const changed = await request(app)
    .patch('/api/auth/update-password')
    .set('Cookie', `${first.access.split(';')[0]}; ${first.csrf.split(';')[0]}`)
    .set('X-CSRF-Token', cookieValue(first.csrf))
    .send({ oldPassword: PASSWORD, newPassword: NEXT_PASSWORD });
  assert.equal(changed.status, 200);

  const oldRefresh = await request(app)
    .post('/api/auth/refresh-token')
    .set('Authorization', `Bearer ${second.response.body.data.refreshToken}`);
  assert.equal(oldRefresh.status, 401);
  const relogin = await login(email, NEXT_PASSWORD);
  assert.equal(relogin.response.status, 200);

  const resetLink = await request(app).get(`/api/auth/reset-password-link/${encodeURIComponent(email)}`);
  assert.equal(resetLink.status, 200);
  const reset = await request(app).post('/api/auth/reset-password').send({
    token: activationToken(),
    newPassword: PASSWORD,
  });
  assert.equal(reset.status, 200);
  const resetRefresh = await request(app)
    .post('/api/auth/refresh-token')
    .set('Authorization', `Bearer ${relogin.response.body.data.refreshToken}`);
  assert.equal(resetRefresh.status, 401);
});

dbTest('authorizes a request only when the role has one required permission', async () => {
  const email = 'authz@example.com';
  await registerVerify(email);
  const session = await login(email);
  const [user] = await db.select({ id: users.id, roleId: users.roleId }).from(users).where(eq(users.email, email));
  const [permission] = await db.insert(permissions).values({ title: 'projects:create' }).returning();
  const middleware = authorization(['projects:create']);
  const requestContext = { userId: user.id, auth: { accessToken: 'unused' } };

  await assert.rejects(() => invoke(middleware, requestContext), (error) => error instanceof HttpError && error.statusCode === 403);

  await db.insert(rolePermissions).values({ roleId: user.roleId, permissionId: permission.id });
  assert.equal(await invoke(middleware, requestContext), 'next');
  assert.equal(session.response.status, 200);
  const [role] = await db.select({ title: roles.title }).from(roles).where(eq(roles.id, user.roleId));
  assert.equal(role.title, 'user');
});

dbTest('rate limits login attempts for one IP and email', async () => {
  rateLimitSettings.max = 2;
  resetRateLimits();
  const email = 'limit@example.com';
  await registerVerify(email);
  const first = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
  const second = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
  const third = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
  assert.equal(first.status, 401);
  assert.equal(second.status, 401);
  assert.equal(third.status, 429);
});

const invoke = (middleware, req) =>
  new Promise((resolve, reject) => {
    middleware(req, { status() { return this; }, json() { return this; } }, (error) => (error ? reject(error) : resolve('next')));
  });
