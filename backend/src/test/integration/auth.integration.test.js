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

dbTest('enforces workspace membership roles and ownership transfer', async () => {
  await registerVerify('owner@example.com');
  await registerVerify('admin@example.com');
  await registerVerify('member@example.com');

  const owner = await login('owner@example.com');
  const ownerCookie = [owner.access.split(';')[0], owner.csrf.split(';')[0]].join('; ');
  const ownerCsrf = cookieValue(owner.csrf);
  const created = await request(app)
    .post('/api/workspaces')
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ name: 'Product team' });
  assert.equal(created.status, 201);
  const workspaceId = created.body.data.id;

  const addedAdmin = await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ email: 'admin@example.com', role: 'admin' });
  assert.equal(addedAdmin.status, 201);

  const admin = await login('admin@example.com');
  const adminCookie = [admin.access.split(';')[0], admin.csrf.split(';')[0]].join('; ');
  const adminCsrf = cookieValue(admin.csrf);
  const workspaceSettings = await request(app)
    .patch(`/api/workspaces/${workspaceId}`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', adminCsrf)
    .send({ name: 'Nope' });
  assert.equal(workspaceSettings.status, 403);

  const addedMember = await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', adminCsrf)
    .send({ email: 'member@example.com', role: 'member' });
  assert.equal(addedMember.status, 201);

  const transfer = await request(app)
    .post(`/api/workspaces/${workspaceId}/transfer-ownership`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ userId: addedAdmin.body.data.userId });
  assert.equal(transfer.status, 200);

  const formerOwnerDelete = await request(app)
    .delete(`/api/workspaces/${workspaceId}`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf);
  assert.equal(formerOwnerDelete.status, 403);

  const deleted = await request(app)
    .delete(`/api/workspaces/${workspaceId}`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', adminCsrf);
  assert.equal(deleted.status, 200);
});

dbTest('enforces project task roles, queries, and optimistic locking', async () => {
  await registerVerify('project-owner@example.com');
  await registerVerify('project-admin@example.com');
  await registerVerify('project-member@example.com');
  const owner = await login('project-owner@example.com');
  const ownerCookie = [owner.access.split(';')[0], owner.csrf.split(';')[0]].join('; ');
  const ownerCsrf = cookieValue(owner.csrf);
  const workspace = await request(app)
    .post('/api/workspaces')
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ name: 'Delivery' });
  const workspaceId = workspace.body.data.id;

  await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ email: 'project-admin@example.com', role: 'admin' });
  const addedMember = await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ email: 'project-member@example.com', role: 'member' });

  const project = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ name: 'Launch', description: 'Release planning' });
  assert.equal(project.status, 201);
  const projectId = project.body.data.id;

  const firstTask = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({
      title: 'Prepare release notes',
      assigneeId: addedMember.body.data.userId,
      dueDate: '2026-12-01',
      priority: 'HIGH',
    });
  assert.equal(firstTask.status, 201);
  assert.equal(firstTask.body.data.version, 1);

  const member = await login('project-member@example.com');
  const memberCookie = [member.access.split(';')[0], member.csrf.split(';')[0]].join('; ');
  const memberCsrf = cookieValue(member.csrf);
  const forbidden = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${firstTask.body.data.id}`)
    .set('Cookie', memberCookie)
    .set('X-CSRF-Token', memberCsrf)
    .send({ priority: 'LOW', version: 1 });
  assert.equal(forbidden.status, 403);

  const statusUpdate = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${firstTask.body.data.id}`)
    .set('Cookie', memberCookie)
    .set('X-CSRF-Token', memberCsrf)
    .send({ status: 'IN_PROGRESS', progress: 40, version: 1 });
  assert.equal(statusUpdate.status, 200);
  assert.equal(statusUpdate.body.data.version, 2);
  assert.equal(statusUpdate.body.data.progress, 40);

  const stale = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${firstTask.body.data.id}`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ title: 'Stale update', version: 1 });
  assert.equal(stale.status, 409);

  const secondTask = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({
      title: 'Prepare launch email',
      assigneeId: addedMember.body.data.userId,
      dueDate: '2026-11-20',
      status: 'TODO',
    });
  assert.equal(secondTask.status, 201);

  const filtered = await request(app)
    .get(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks?search=launch&status=TODO&sortBy=dueDate&sortDirection=asc&page=1&pageSize=1`)
    .set('Cookie', ownerCookie);
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.data.items.length, 1);
  assert.equal(filtered.body.data.items[0].id, secondTask.body.data.id);
  assert.equal(filtered.body.data.pagination.total, 1);

  const completed = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${firstTask.body.data.id}`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ status: 'DONE', progress: 100, version: 2 });
  assert.equal(completed.status, 200);

  const detail = await request(app).get(`/api/workspaces/${workspaceId}/projects/${projectId}`).set('Cookie', ownerCookie);
  assert.equal(detail.body.data.statistics.total, 2);
  assert.equal(detail.body.data.statistics.todo, 1);
  assert.equal(detail.body.data.statistics.inProgress, 0);
  assert.equal(detail.body.data.statistics.done, 1);
  assert.equal(detail.body.data.statistics.progress, 50);
  assert.equal(detail.body.data.statistics.byAssignee.length, 1);
  assert.equal(detail.body.data.statistics.byAssignee[0].userId, addedMember.body.data.userId);
  assert.equal(detail.body.data.statistics.byAssignee[0].progress, 50);
});

dbTest('assigns tasks only to current workspace members', async () => {
  await registerVerify('assign-owner@example.com');
  await registerVerify('assign-admin@example.com');
  await registerVerify('assign-member@example.com');
  const owner = await login('assign-owner@example.com');
  const ownerCookie = [owner.access.split(';')[0], owner.csrf.split(';')[0]].join('; ');
  const ownerCsrf = cookieValue(owner.csrf);
  const workspace = await request(app)
    .post('/api/workspaces')
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ name: 'Assignments' });
  const workspaceId = workspace.body.data.id;
  const addedAdmin = await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ email: 'assign-admin@example.com', role: 'admin' });
  const addedMember = await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ email: 'assign-member@example.com', role: 'member' });
  const project = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ name: 'Assignment rules' });
  const projectId = project.body.data.id;
  const memberList = await request(app)
    .get(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', ownerCookie);
  const ownerId = memberList.body.data.find((member) => member.role === 'owner').userId;
  const taskUrl = `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`;
  const taskBody = (assigneeId) => ({
    title: 'Assign work',
    assigneeId,
    dueDate: '2026-12-01',
  });

  const ownerAssignee = await request(app)
    .post(taskUrl)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send(taskBody(ownerId));
  assert.equal(ownerAssignee.status, 400);

  const adminAssignee = await request(app)
    .post(taskUrl)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send(taskBody(addedAdmin.body.data.userId));
  assert.equal(adminAssignee.status, 400);

  const created = await request(app)
    .post(taskUrl)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send(taskBody(addedMember.body.data.userId));
  assert.equal(created.status, 201);

  const reassigned = await request(app)
    .patch(`${taskUrl}/${created.body.data.id}`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ assigneeId: addedAdmin.body.data.userId, version: 1 });
  assert.equal(reassigned.status, 400);

  const promoted = await request(app)
    .patch(`/api/workspaces/${workspaceId}/members/${addedMember.body.data.userId}`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ role: 'admin' });
  assert.equal(promoted.status, 200);

  const kept = await request(app)
    .patch(`${taskUrl}/${created.body.data.id}`)
    .set('Cookie', ownerCookie)
    .set('X-CSRF-Token', ownerCsrf)
    .send({ title: 'Still assigned', assigneeId: addedMember.body.data.userId, version: 1 });
  assert.equal(kept.status, 200);
  assert.equal(kept.body.data.assigneeId, addedMember.body.data.userId);
  assert.equal(kept.body.data.version, 2);
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
