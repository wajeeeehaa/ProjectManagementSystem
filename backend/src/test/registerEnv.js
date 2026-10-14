process.env.NODE_ENV ??= 'test';
process.env.SERVER_PORT ??= '4000';
process.env.SERVER_HOST ??= '127.0.0.1';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL?.trim() ||
  'postgres://postgres:postgres@127.0.0.1:5432/projectmanagementsystem_test';
process.env.JWT_SECRET ??= 'test-only-hmac-secret-not-for-production-use';
process.env.JWT_ACCESS_EXPIRATION_TIME ??= '15m';
process.env.JWT_REFRESH_EXPIRATION_TIME ??= '7d';
process.env.FRONTEND_URL ??= 'http://localhost:3000';
process.env.SECURE_COOKIE ??= 'false';
process.env.SAME_SITE ??= 'lax';
process.env.SMTP_HOST ??= '127.0.0.1';
process.env.SMTP_PORT ??= '1025';
process.env.SMTP_FROM ??= 'noreply@localhost';
process.env.AUTH_RATE_LIMIT_WINDOW_MS ??= '900000';
process.env.AUTH_RATE_LIMIT_MAX ??= '20';
process.env.CLEANUP_INTERVAL_MS ??= '900000';
