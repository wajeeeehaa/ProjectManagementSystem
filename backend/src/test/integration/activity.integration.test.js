import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, beforeEach, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import request from 'supertest';
import { WebSocket } from 'ws';
import { db, pool } from '../../../db/database.js';
import app from '../../app.js';
import { rateLimitSettings, resetRateLimits } from '../../middlewares/rateLimit.middleware.js';
import { setEmailTransport } from '../../services/email.service.js';
import { attachActivityStream } from '../../services/realtime.service.js';

const PASSWORD = 'Str0ng!Pass';
const sentEmails = [];
let databaseReady = false;
let server;
let stream;
let wsUrl = '';

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

const cookieLine = (response, name) => {
  const raw = response.headers['set-cookie'];
  const lines = !raw ? [] : Array.isArray(raw) ? raw : [raw];
  return lines.find((line) => line.startsWith(`${name}=`));
};

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
  const verified = await request(app).post(`/api/auth/verify/${encodeURIComponent(activationToken())}`);
  assert.equal(verified.status, 200);
};

const login = async (email) => {
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  const access = cookieLine(response, 'accessToken');
  const csrf = cookieLine(response, 'csrfToken');
  return {
    cookie: [access.split(';')[0], csrf.split(';')[0]].join('; '),
    accessCookie: access.split(';')[0],
    csrf: cookieValue(csrf),
  };
};

const dbTest = (name, fn) =>
  it(name, async (t) => {
    if (!databaseReady) {
      t.skip('PostgreSQL is not available');
      return;
    }
    await fn();
  });

const activityFeed = async (cookie) => {
  const response = await request(app).get('/api/activity?limit=100').set('Cookie', cookie);
  assert.equal(response.status, 200);
  return response.body.data;
};

const eventTypes = (feed) => feed.items.map((item) => item.eventType);

const waitForMessage = (socket, predicate, timeoutMs = 2000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    socket.off('message', onMessage);
    reject(new Error('Timed out waiting for a socket message'));
  }, timeoutMs);
  const onMessage = (data) => {
    const message = JSON.parse(data.toString());
    if (!predicate(message)) return;
    clearTimeout(timer);
    socket.off('message', onMessage);
    resolve(message);
  };
  socket.on('message', onMessage);
});

const openSocket = (accessCookie) => new Promise((resolve, reject) => {
  const socket = new WebSocket(wsUrl, {
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: accessCookie,
    },
  });
  const ready = waitForMessage(socket, (message) => message.type === 'ready');
  socket.once('error', reject);
  ready.then(() => resolve(socket)).catch(reject);
});

before(async () => {
  try {
    await ensureTestDatabase();
    const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../migrations');
    await migrate(db, { migrationsFolder });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    stream = attachActivityStream(server);
    wsUrl = `ws://127.0.0.1:${server.address().port}/api/activity/stream`;
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
  stream?.close();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

dbTest('records task activity with the task change and hides it after access is lost', async () => {
  await registerVerify('activity-owner@example.com');
  await registerVerify('activity-member@example.com');
  await registerVerify('activity-other@example.com');
  await registerVerify('activity-outsider@example.com');

  const owner = await login('activity-owner@example.com');
  const workspace = await request(app)
    .post('/api/workspaces')
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ name: 'Activity workspace' });
  assert.equal(workspace.status, 201);
  const workspaceId = workspace.body.data.id;

  const addedMember = await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ email: 'activity-member@example.com', role: 'member' });
  assert.equal(addedMember.status, 201);
  const otherMember = await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ email: 'activity-other@example.com', role: 'member' });
  assert.equal(otherMember.status, 201);

  const project = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ name: 'Launch', description: 'Release planning' });
  const projectId = project.body.data.id;

  const created = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({
      title: 'Prepare release notes',
      assigneeId: addedMember.body.data.userId,
      dueDate: '2026-12-01',
      priority: 'HIGH',
      status: 'TODO',
    });
  assert.equal(created.status, 201);
  const taskId = created.body.data.id;

  const afterCreate = await activityFeed(owner.cookie);
  assert.deepEqual(eventTypes(afterCreate), ['TASK_CREATED']);
  assert.equal(afterCreate.items[0].task.title, 'Prepare release notes');
  assert.equal(afterCreate.items[0].details.status, 'TODO');
  assert.equal(afterCreate.items[0].details.priority, 'HIGH');
  assert.deepEqual(afterCreate.items[0].details.assignees.map((person) => person.id), [addedMember.body.data.userId]);
  assert.equal(afterCreate.items[0].actor.id, workspace.body.data.createdBy);

  const titleOnly = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ title: 'Prepare the release notes', progress: 10, version: 1 });
  assert.equal(titleOnly.status, 200);
  assert.deepEqual(eventTypes(await activityFeed(owner.cookie)), ['TASK_CREATED']);

  const member = await login('activity-member@example.com');
  const sameStatus = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', member.cookie)
    .set('X-CSRF-Token', member.csrf)
    .send({ status: 'TODO', progress: 15, version: 2 });
  assert.equal(sameStatus.status, 200);
  assert.deepEqual(eventTypes(await activityFeed(owner.cookie)), ['TASK_CREATED']);

  const statusUpdate = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', member.cookie)
    .set('X-CSRF-Token', member.csrf)
    .send({ status: 'IN_PROGRESS', progress: 40, version: 3 });
  assert.equal(statusUpdate.status, 200);

  const priorityUpdate = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ priority: 'LOW', version: 4 });
  assert.equal(priorityUpdate.status, 200);

  const reassigned = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ assigneeId: otherMember.body.data.userId, version: 5 });
  assert.equal(reassigned.status, 200);

    const changed = await activityFeed(owner.cookie);
    const changedByType = Object.fromEntries(changed.items.map((item) => [item.eventType, item]));
    assert.deepEqual(eventTypes(changed), [
      'TASK_ASSIGNED',
      'TASK_PRIORITY_CHANGED',
      'TASK_STATUS_CHANGED',
      'TASK_CREATED',
    ]);
    assert.equal(changedByType.TASK_STATUS_CHANGED.details.from, 'TODO');
    assert.equal(changedByType.TASK_STATUS_CHANGED.details.to, 'IN_PROGRESS');
    assert.equal(changedByType.TASK_PRIORITY_CHANGED.details.from, 'HIGH');
    assert.equal(changedByType.TASK_PRIORITY_CHANGED.details.to, 'LOW');
    assert.deepEqual(changedByType.TASK_ASSIGNED.details.to.map((person) => person.id), [otherMember.body.data.userId]);

  const beforeConflict = changed.items.length;
  const stale = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ status: 'DONE', version: 5 });
  assert.equal(stale.status, 409);
  assert.equal((await activityFeed(owner.cookie)).items.length, beforeConflict);

  const removed = await request(app)
    .delete(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf);
  assert.equal(removed.status, 200);
  const missing = await request(app)
    .get(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', owner.cookie);
  assert.equal(missing.status, 404);

  const afterDelete = await activityFeed(owner.cookie);
  assert.equal(afterDelete.items[0].eventType, 'TASK_DELETED');
  assert.equal(afterDelete.items[0].task.id, taskId);
  assert.equal(afterDelete.items[0].task.title, 'Prepare the release notes');

  const outsider = await login('activity-outsider@example.com');
  const hidden = await activityFeed(outsider.cookie);
  assert.equal(hidden.items.length, 0);

  const anonymous = await request(app).get('/api/activity');
  assert.equal(anonymous.status, 401);

  const deletedProject = await request(app)
    .delete(`/api/workspaces/${workspaceId}/projects/${projectId}`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf);
  assert.equal(deletedProject.status, 200);
  assert.equal((await activityFeed(owner.cookie)).items.length, 0);
});

dbTest('pushes activity only to current workspace members', async () => {
  await registerVerify('stream-owner@example.com');
  await registerVerify('stream-member@example.com');
  await registerVerify('stream-outsider@example.com');

  const owner = await login('stream-owner@example.com');
  const member = await login('stream-member@example.com');
  const outsider = await login('stream-outsider@example.com');
  const workspace = await request(app)
    .post('/api/workspaces')
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ name: 'Stream workspace' });
  const workspaceId = workspace.body.data.id;
  const addedMember = await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ email: 'stream-member@example.com', role: 'member' });
  const project = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ name: 'Launch', description: 'Release planning' });
  const projectId = project.body.data.id;

  const memberSocket = await openSocket(member.accessCookie);
  const outsiderSocket = await openSocket(outsider.accessCookie);
  let outsiderSawActivity = false;
  outsiderSocket.on('message', (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === 'activity') outsiderSawActivity = true;
  });

  const incoming = waitForMessage(memberSocket, (message) => message.type === 'activity');
  const created = await request(app)
    .post(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({
      title: 'Ship the notes',
      assigneeId: addedMember.body.data.userId,
      dueDate: '2026-12-01',
      priority: 'MEDIUM',
    });
  assert.equal(created.status, 201);
  const message = await incoming;
  assert.equal(message.activity.eventType, 'TASK_CREATED');
  assert.equal(message.activity.task.title, 'Ship the notes');
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(outsiderSawActivity, false);

  const revoked = waitForMessage(memberSocket, (message) => message.type === 'revoked');
  const removal = await request(app)
    .delete(`/api/workspaces/${workspaceId}/members/${addedMember.body.data.userId}`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf);
  assert.equal(removal.status, 200);
  const revokedMessage = await revoked;
  assert.equal(revokedMessage.workspaceId, workspaceId);

  const taskId = created.body.data.id;
  let memberSawMore = false;
  memberSocket.on('message', (data) => {
    const next = JSON.parse(data.toString());
    if (next.type === 'activity') memberSawMore = true;
  });
  const priorityUpdate = await request(app)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', owner.cookie)
    .set('X-CSRF-Token', owner.csrf)
    .send({ priority: 'HIGH', version: 1 });
  assert.equal(priorityUpdate.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(memberSawMore, false);
  const memberFeed = await activityFeed(member.cookie);
  assert.equal(memberFeed.items.some((item) => item.workspace.id === workspaceId), false);

  const rejected = new WebSocket(wsUrl, {
    headers: {
      Origin: 'http://evil.example',
      Cookie: owner.accessCookie,
    },
  });
  const closed = await new Promise((resolve) => {
    rejected.once('error', () => resolve('error'));
    rejected.once('unexpected-response', () => resolve('rejected'));
    rejected.once('open', () => resolve('open'));
  });
  assert.notEqual(closed, 'open');
  rejected.terminate();
  memberSocket.close();
  outsiderSocket.close();
});
