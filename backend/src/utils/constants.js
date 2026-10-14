import './loadEnv.js';
import { assertRuntimeCookieConfig } from './cookieConfig.js';
import { parseDurationSeconds } from './duration.js';

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  NOT_IMPLEMENTED: 501,
};

const readRequired = (name) => {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    console.error(`[config] ${name} is empty`);
    process.exit(1);
  }
  return value.trim();
};

const readPositiveInteger = (name) => {
  const raw = readRequired(name);
  if (!/^\d+$/.test(raw)) {
    console.error(`[config] ${name} must be a positive integer`);
    process.exit(1);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    console.error(`[config] ${name} must be a positive integer`);
    process.exit(1);
  }
  return value;
};

export const parseCorsOrigins = (raw) =>
  raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

export const SERVER_PORT = readRequired('SERVER_PORT');
export const SERVER_HOST = readRequired('SERVER_HOST');

const corsRaw = process.env.CORS_ORIGINS;
if (typeof corsRaw !== 'string' || corsRaw.trim() === '') {
  console.error('[config] CORS_ORIGINS is empty');
  process.exit(1);
}

export const CORS_ORIGINS = parseCorsOrigins(corsRaw);

if (CORS_ORIGINS.length === 0) {
  console.error('[config] CORS_ORIGINS is empty');
  process.exit(1);
}

export const DATABASE_URL = readRequired('DATABASE_URL');

const jwtSecret = readRequired('JWT_SECRET');
if (jwtSecret.length < 32) {
  console.error('[config] JWT_SECRET must be at least 32 characters');
  process.exit(1);
}
export const JWT_SECRET = jwtSecret;

const readDuration = (name) => {
  try {
    return parseDurationSeconds(readRequired(name));
  } catch (error) {
    console.error(`[config] ${name} is invalid`);
    process.exit(1);
  }
};

export const ACCESS_TTL_SECONDS = readDuration('JWT_ACCESS_EXPIRATION_TIME');
export const REFRESH_TTL_SECONDS = readDuration('JWT_REFRESH_EXPIRATION_TIME');

const frontendUrl = readRequired('FRONTEND_URL');
try {
  const parsed = new URL(frontendUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('unsupported protocol');
  }
} catch {
  console.error('[config] FRONTEND_URL must be an absolute http(s) URL');
  process.exit(1);
}
export const FRONTEND_URL = frontendUrl;

let cookiePolicy;
try {
  cookiePolicy = assertRuntimeCookieConfig({
    nodeEnv: process.env.NODE_ENV?.trim() ?? '',
    secureCookie: process.env.SECURE_COOKIE,
    sameSite: process.env.SAME_SITE,
  });
} catch (error) {
  console.error(`[config] ${error.message}`);
  process.exit(1);
}
export const COOKIE_POLICY = cookiePolicy;

export const SMTP_HOST = readRequired('SMTP_HOST');
export const SMTP_PORT = readPositiveInteger('SMTP_PORT');
export const SMTP_USER = process.env.SMTP_USER?.trim() ?? '';
export const SMTP_PASS = process.env.SMTP_PASS ?? '';
export const SMTP_FROM = readRequired('SMTP_FROM');

export const AUTH_RATE_LIMIT_WINDOW_MS = readPositiveInteger('AUTH_RATE_LIMIT_WINDOW_MS');
export const AUTH_RATE_LIMIT_MAX = readPositiveInteger('AUTH_RATE_LIMIT_MAX');
export const CLEANUP_INTERVAL_MS = readPositiveInteger('CLEANUP_INTERVAL_MS');

export const ACTIVATION_TTL_SECONDS = 30 * 60;
export const RESET_TTL_SECONDS = 15 * 60;
export const DEFAULT_ROLE_TITLE = 'user';
