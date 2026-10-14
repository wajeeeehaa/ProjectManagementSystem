import { HTTP_STATUS, AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS } from '../utils/constants.js';
import { sha256 } from '../utils/crypto.helper.js';
import { errorResponse } from '../utils/customResponses.js';

export const rateLimitSettings = {
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
};

const buckets = new Map();

export const resetRateLimits = () => {
  buckets.clear();
};

export const clientAddress = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const normalizedEmail = (value) => String(value ?? '').trim().toLowerCase();

export const emailRateKey = (req) =>
  `${clientAddress(req)}:${normalizedEmail(req.body?.email ?? req.params?.email)}`;

export const tokenRateKey = (req) => `${clientAddress(req)}:${sha256(String(req.params?.token ?? ''))}`;

export const rateLimit = ({ name, key }) => (req, res, next) => {
  const now = Date.now();
  if (buckets.size > 10000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  const bucketKey = `${name}:${key(req)}`;
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + rateLimitSettings.windowMs });
    return next();
  }

  if (current.count >= rateLimitSettings.max) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
    return errorResponse(res, {
      statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
      message: 'Too many requests',
    });
  }

  current.count += 1;
  return next();
};
