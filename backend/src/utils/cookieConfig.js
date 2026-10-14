const SAME_SITE_VALUES = new Set(['lax', 'strict', 'none']);

export const parseSecureCookie = (raw) => {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value !== 'true' && value !== 'false') {
    throw new Error('SECURE_COOKIE must be true or false');
  }
  return value === 'true';
};

export const parseSameSite = (raw) => {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!SAME_SITE_VALUES.has(value)) {
    throw new Error('SAME_SITE must be lax, strict, or none');
  }
  return value;
};

export const assertRuntimeCookieConfig = ({ nodeEnv, secureCookie, sameSite }) => {
  const secure = parseSecureCookie(secureCookie);
  const parsedSameSite = parseSameSite(sameSite);

  if (nodeEnv === 'production' && !secure) {
    throw new Error('SECURE_COOKIE must be true in production');
  }

  if (nodeEnv === 'production' && parsedSameSite === 'none') {
    throw new Error('SAME_SITE=none conflicts with same-origin deployment');
  }

  if (parsedSameSite === 'none' && !secure) {
    throw new Error('SAME_SITE=none requires SECURE_COOKIE=true');
  }

  return { secure, sameSite: parsedSameSite };
};

export const sameSiteAttribute = (sameSite) => {
  if (sameSite === 'strict') return 'Strict';
  if (sameSite === 'none') return 'None';
  return 'Lax';
};
