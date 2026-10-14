import { CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../utils/cookies.js';
import { getBearerToken, readCookie, readCsrfHeader } from '../utils/authToken.helper.js';
import { HTTP_STATUS, JWT_SECRET } from '../utils/constants.js';
import { digestEqual, hmacSha256 } from '../utils/crypto.helper.js';
import { errorResponse } from '../utils/customResponses.js';

const sameCsrfValue = (left, right) =>
  digestEqual(hmacSha256(left, JWT_SECRET), hmacSha256(right, JWT_SECRET));

export const csrfProtection = (req, res, next) => {
  if (getBearerToken(req)) return next();

  const cookieToken = readCookie(req, CSRF_COOKIE_NAME);
  const headerToken = readCsrfHeader(req);
  const boundHash = req.auth?.csrfHash;
  if (
    !cookieToken ||
    !headerToken ||
    !boundHash ||
    !sameCsrfValue(cookieToken, headerToken) ||
    !digestEqual(hmacSha256(cookieToken, JWT_SECRET), boundHash)
  ) {
    return errorResponse(res, {
      statusCode: HTTP_STATUS.FORBIDDEN,
      message: 'Invalid CSRF token',
    });
  }

  return next();
};

export const refreshCsrf = (req, res, next) => {
  if (getBearerToken(req)) return next();
  if (!readCookie(req, REFRESH_COOKIE_NAME)) {
    return errorResponse(res, {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      message: 'Unauthorized',
    });
  }

  const cookieToken = readCookie(req, CSRF_COOKIE_NAME);
  const headerToken = readCsrfHeader(req);
  if (!cookieToken || !headerToken || !sameCsrfValue(cookieToken, headerToken)) {
    return errorResponse(res, {
      statusCode: HTTP_STATUS.FORBIDDEN,
      message: 'Invalid CSRF token',
    });
  }

  req.csrfToken = cookieToken;
  return next();
};
