import { eq } from 'drizzle-orm';
import { db } from '../../db/database.js';
import { permissions, rolePermissions, users } from '../../db/schema/index.js';
import { getBearerOrCookieToken } from '../utils/authToken.helper.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { verifyAccessToken } from '../utils/jwt.helper.js';
import { findSessionById, findUserById, isAccessTokenBlacklisted } from '../services/session.service.js';

export const authenticateAccess = async (req) => {
  if (!db) throw new HttpError(HTTP_STATUS.SERVER_ERROR, 'Something went wrong');

  const token = getBearerOrCookieToken(req);
  if (!token) throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
  if (await isAccessTokenBlacklisted(token)) {
    throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
  }

  const payload = verifyAccessToken(token);
  const user = await findUserById(db, payload.id);
  if (!user || !user.isVerified) throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');

  const session = await findSessionById(payload.sid);
  const sessionActive =
    session &&
    session.userId === user.id &&
    !session.revokedAt &&
    !session.replacedAt &&
    new Date(session.expiresAt).getTime() > Date.now();
  if (!sessionActive) throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');

  return {
    userId: user.id,
    auth: {
      userId: user.id,
      sessionId: session.id,
      familyId: session.familyId,
      accessToken: token,
      csrfHash: session.csrfHash,
    },
  };
};

export const authentication = asyncHandler(async (req, res, next) => {
  void res;
  const access = await authenticateAccess(req);
  req.userId = access.userId;
  req.auth = access.auth;
  return next();
});

export const authorization = (requiredPermissions = []) =>
  asyncHandler(async (req, res, next) => {
    void res;
    if (!req.userId) throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    if (!db || !Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
      throw new HttpError(HTTP_STATUS.FORBIDDEN, 'Forbidden');
    }

    const rows = await db
      .select({ title: permissions.title })
      .from(users)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, users.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(users.id, req.userId));
    const owned = new Set(rows.map((row) => row.title));
    if (!requiredPermissions.some((permission) => owned.has(permission))) {
      throw new HttpError(HTTP_STATUS.FORBIDDEN, 'Forbidden');
    }
    return next();
  });
