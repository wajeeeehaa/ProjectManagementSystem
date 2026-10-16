import { and, eq, inArray } from 'drizzle-orm';
import { WebSocket, WebSocketServer } from 'ws';
import { db } from '../../db/database.js';
import { workspaceMembers } from '../../db/schema/index.js';
import { authenticateAccess } from '../middlewares/authenticationMiddlewares.js';
import { CORS_ORIGINS } from '../utils/constants.js';

const STREAM_PATH = '/api/activity/stream';
const socketsByUser = new Map();
const socketsByWorkspace = new Map();

const addToSet = (map, key, socket) => {
  const existing = map.get(key);
  if (existing) {
    existing.add(socket);
    return;
  }
  map.set(key, new Set([socket]));
};

const removeFromSet = (map, key, socket) => {
  const existing = map.get(key);
  if (!existing) return;
  existing.delete(socket);
  if (existing.size === 0) map.delete(key);
};

const send = (socket, payload) => {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch (error) {
    console.error('[activity] socket send failed', error);
  }
};

const unsubscribeAll = (socket) => {
  for (const workspaceId of socket.workspaceIds ?? []) {
    removeFromSet(socketsByWorkspace, workspaceId, socket);
  }
  if (socket.userId) removeFromSet(socketsByUser, socket.userId, socket);
  socket.workspaceIds = new Set();
};

const subscribeSocket = async (socket, userId) => {
  const rows = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));
  socket.userId = userId;
  socket.workspaceIds = new Set(rows.map((row) => row.workspaceId));
  addToSet(socketsByUser, userId, socket);
  for (const workspaceId of socket.workspaceIds) {
    addToSet(socketsByWorkspace, workspaceId, socket);
  }
};

export const revokeWorkspaceAccess = (workspaceId, userId) => {
  const sockets = socketsByUser.get(userId);
  if (!sockets) return;
  for (const socket of [...sockets]) {
    if (!socket.workspaceIds?.has(workspaceId)) continue;
    socket.workspaceIds.delete(workspaceId);
    removeFromSet(socketsByWorkspace, workspaceId, socket);
    send(socket, { type: 'revoked', workspaceId });
  }
};

export const publishActivities = async (items) => {
  if (!items?.length || !db) return;
  try {
    for (const activity of items) {
      const workspaceId = activity.workspace.id;
      const sockets = socketsByWorkspace.get(workspaceId);
      if (!sockets || sockets.size === 0) continue;
      const connected = [...sockets];
      const userIds = [...new Set(connected.map((socket) => socket.userId))];
      const members = await db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(and(
          eq(workspaceMembers.workspaceId, workspaceId),
          inArray(workspaceMembers.userId, userIds),
        ));
      const allowed = new Set(members.map((row) => row.userId));
      for (const socket of connected) {
        if (!allowed.has(socket.userId)) continue;
        send(socket, { type: 'activity', activity });
      }
    }
  } catch (error) {
    console.error('[activity] publish failed', error);
  }
};

const originOf = (request) => {
  const value = request.headers.origin;
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

const rejectUpgrade = (socket, status, reason) => {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

export const attachActivityStream = (server) => {
  const wss = new WebSocketServer({ noServer: true });

  const onUpgrade = (request, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    } catch {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }
    if (pathname !== STREAM_PATH) {
      socket.destroy();
      return;
    }
    if (!CORS_ORIGINS.includes(originOf(request))) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    authenticateAccess(request).then((access) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, access);
      });
    }).catch((error) => {
      const status = error?.statusCode === 500 ? 500 : 401;
      rejectUpgrade(socket, status, status === 500 ? 'Internal Server Error' : 'Unauthorized');
    });
  };

  wss.on('connection', (ws, _request, access) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('close', () => unsubscribeAll(ws));
    subscribeSocket(ws, access.userId).then(() => {
      send(ws, { type: 'ready' });
    }).catch((error) => {
      console.error('[activity] subscribe failed', error);
      ws.close(1011, 'Unable to subscribe');
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  heartbeat.unref?.();
  server.on('upgrade', onUpgrade);

  return {
    close() {
      clearInterval(heartbeat);
      server.off('upgrade', onUpgrade);
      for (const client of wss.clients) client.terminate();
      wss.close();
    },
  };
};
