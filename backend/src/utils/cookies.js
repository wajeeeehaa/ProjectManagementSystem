import {
  ACCESS_TTL_SECONDS,
  COOKIE_POLICY,
  REFRESH_TTL_SECONDS,
} from './constants.js';
import { sameSiteAttribute } from './cookieConfig.js';

export const ACCESS_COOKIE_NAME = 'accessToken';
export const REFRESH_COOKIE_NAME = 'refreshToken';
export const CSRF_COOKIE_NAME = 'csrfToken';
export const ACCESS_COOKIE_PATH = '/api';
export const REFRESH_COOKIE_PATH = '/api/auth/refresh-token';
export const CSRF_COOKIE_PATH = '/';
export const CSRF_HEADER = 'x-csrf-token';

export const serializeCookie = (name, value, { httpOnly, path, maxAge }) => {
  const parts = [
    `${name}=${value}`,
    `Max-Age=${maxAge}`,
    `Path=${path}`,
    `SameSite=${sameSiteAttribute(COOKIE_POLICY.sameSite)}`,
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (COOKIE_POLICY.secure) parts.push('Secure');
  return parts.join('; ');
};

export const buildAuthCookies = ({ accessToken, refreshToken, csrfToken }) => [
  serializeCookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    path: ACCESS_COOKIE_PATH,
    maxAge: ACCESS_TTL_SECONDS,
  }),
  serializeCookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_SECONDS,
  }),
  serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    path: CSRF_COOKIE_PATH,
    maxAge: REFRESH_TTL_SECONDS,
  }),
];

export const clearAuthCookies = () => [
  serializeCookie(ACCESS_COOKIE_NAME, '', {
    httpOnly: true,
    path: ACCESS_COOKIE_PATH,
    maxAge: 0,
  }),
  serializeCookie(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    maxAge: 0,
  }),
  serializeCookie(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    path: CSRF_COOKIE_PATH,
    maxAge: 0,
  }),
];

export const applyCookies = (res, cookies) => {
  for (const cookie of cookies) {
    res.append('Set-Cookie', cookie);
  }
};
