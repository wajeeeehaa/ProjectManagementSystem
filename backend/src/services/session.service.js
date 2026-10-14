import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { db } from '../../db/database.js';
import { blacklistTokens, refreshSessions, roles, users } from '../../db/schema/index.js';
import { buildAuthCookies } from '../utils/cookies.js';
import { digestEqual, hmacSha256, randomToken, sha256 } from '../utils/crypto.helper.js';
import { HTTP_STATUS, JWT_SECRET, REFRESH_TTL_SECONDS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../utils/jwt.helper.js';
import { toPublicUser } from './user.mapper.js';

const requireDb = () => {
  if (!db) throw new HttpError(HTTP_STATUS.SERVER_ERROR, 'Something went wrong');
  return db;
};

export const profileSelection = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  isVerified: users.isVerified,
  passwordHash: users.passwordHash,
  roleId: users.roleId,
  roleTitle: roles.title,
  activationOtpHash: users.activationOtpHash,
  activationOtpExpiresAt: users.activationOtpExpiresAt,
};

export const hashCsrf = (value) => hmacSha256(value, JWT_SECRET);

export const findUserById = async (executor, userId) => {
  const [user] = await executor
    .select(profileSelection)
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
};

export const findUserByEmail = async (executor, email) => {
  const [user] = await executor
    .select(profileSelection)
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.email, email))
    .limit(1);
  return user ?? null;
};

const issueSession = async (executor, { userId, familyId }) => {
  const jti = randomUUID();
  const csrfToken = randomToken();
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

  await executor.insert(refreshSessions).values({
    id: sessionId,
    jtiHash: sha256(jti),
    userId,
    familyId,
    expiresAt,
    csrfHash: hashCsrf(csrfToken),
  });

  const accessToken = signAccessToken({ id: userId, sid: sessionId });
  const refreshToken = signRefreshToken({ id: userId, fid: familyId, jti });
  return {
    accessToken,
    refreshToken,
    csrfToken,
    cookies: buildAuthCookies({ accessToken, refreshToken, csrfToken }),
  };
};

export const createLoginSession = (userId) =>
  requireDb().transaction(async (tx) => issueSession(tx, { userId, familyId: randomUUID() }));

export const revokeFamily = (executor, familyId) =>
  executor
    .update(refreshSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshSessions.familyId, familyId), isNull(refreshSessions.revokedAt)));

export const revokeAllUserSessions = (executor, userId) =>
  executor
    .update(refreshSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));

export const blacklistAccessToken = async (executor, token) => {
  const payload = verifyAccessToken(token);
  await executor
    .insert(blacklistTokens)
    .values({
      tokenHash: sha256(token),
      expiresAt: new Date(payload.exp * 1000),
    })
    .onConflictDoNothing();
};

export const isAccessTokenBlacklisted = async (token, now = new Date()) => {
  const [row] = await requireDb()
    .select({ expiresAt: blacklistTokens.expiresAt })
    .from(blacklistTokens)
    .where(eq(blacklistTokens.tokenHash, sha256(token)))
    .limit(1);
  return Boolean(row && new Date(row.expiresAt).getTime() > now.getTime());
};

export const findSessionById = async (sessionId) => {
  const [session] = await requireDb()
    .select()
    .from(refreshSessions)
    .where(eq(refreshSessions.id, sessionId))
    .limit(1);
  return session ?? null;
};

const finishRotation = (outcome) => {
  if (outcome.status === 'missing') throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
  if (outcome.status === 'reused') throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Session is no longer valid');
  if (outcome.status === 'expired') throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token has expired');
  if (outcome.status === 'csrf') throw new HttpError(HTTP_STATUS.FORBIDDEN, 'Invalid CSRF token');
  return outcome;
};

export const rotateRefreshSession = async (rawToken, { requireCsrf, csrfToken }) => {
  const payload = verifyRefreshToken(rawToken);
  const outcome = await requireDb().transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(refreshSessions)
      .where(eq(refreshSessions.jtiHash, sha256(payload.jti)))
      .limit(1)
      .for('update');

    if (!session) return { status: 'missing' };

    if (session.userId !== payload.id || session.familyId !== payload.fid || session.revokedAt || session.replacedAt) {
      await revokeFamily(tx, session.familyId);
      return { status: 'reused' };
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) return { status: 'expired' };

    if (requireCsrf) {
      const presented = typeof csrfToken === 'string' ? hashCsrf(csrfToken) : '';
      if (!digestEqual(presented, session.csrfHash)) return { status: 'csrf' };
    }

    const user = await findUserById(tx, payload.id);
    if (!user || !user.isVerified) {
      await revokeFamily(tx, session.familyId);
      return { status: 'reused' };
    }

    const replaced = await tx
      .update(refreshSessions)
      .set({ replacedAt: new Date() })
      .where(
        and(
          eq(refreshSessions.id, session.id),
          isNull(refreshSessions.replacedAt),
          isNull(refreshSessions.revokedAt),
        ),
      )
      .returning({ id: refreshSessions.id });

    if (replaced.length === 0) {
      await revokeFamily(tx, session.familyId);
      return { status: 'reused' };
    }

    const issued = await issueSession(tx, { userId: user.id, familyId: session.familyId });
    return { status: 'ok', ...issued, user: toPublicUser(user) };
  });

  return finishRotation(outcome);
};

export const logoutCurrentSession = ({ accessToken, familyId }) =>
  requireDb().transaction(async (tx) => {
    await blacklistAccessToken(tx, accessToken);
    await revokeFamily(tx, familyId);
  });

export const cleanupExpiredAuthRecords = async (now = new Date()) => {
  const database = requireDb();
  await database.delete(blacklistTokens).where(lt(blacklistTokens.expiresAt, now));
  await database.delete(refreshSessions).where(lt(refreshSessions.expiresAt, now));
};
