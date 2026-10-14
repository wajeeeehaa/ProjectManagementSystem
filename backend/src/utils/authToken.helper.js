import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from './cookies.js';

export const readCookie = (req, name) => {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value || null;
  }

  return null;
};

export const getBearerToken = (req) => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
};

export const getBearerOrCookieToken = (req) =>
  getBearerToken(req) ?? readCookie(req, ACCESS_COOKIE_NAME);

export const getRefreshCredential = (req) => {
  const bearer = getBearerToken(req);
  if (bearer) return { token: bearer, source: 'bearer' };
  const cookie = readCookie(req, REFRESH_COOKIE_NAME);
  if (cookie) return { token: cookie, source: 'cookie' };
  return null;
};

export const readCsrfHeader = (req) => {
  const value = req.get?.('X-CSRF-Token') ?? req.headers?.['x-csrf-token'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};
