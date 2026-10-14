import './loadEnv.js';

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
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
