const parseCookieHeader = (cookieHeader, name) => {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      const value = rawValue.join('=').trim();
      return value || null;
    }
  }

  return null;
};

/**
 * Prefer Authorization Bearer, then the access-token cookie from the Cookie header.
 * Cookie-parser is not used. If ACCESS_TOKEN_COOKIE_NAME is empty, the cookie is not read.
 */
export const getBearerOrCookieToken = (req) => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) return token;
  }

  const cookieName = process.env.ACCESS_TOKEN_COOKIE_NAME?.trim();
  if (!cookieName) return null;

  return parseCookieHeader(req.headers?.cookie, cookieName);
};
