import bcrypt from 'bcrypt';

export const BCRYPT_COST = 10;
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters, no more than 72 bytes, and include an uppercase letter, a lowercase letter, a digit, and a special character.';

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// Used only to keep unknown-email login comparisons on the same bcrypt cost.
export const DUMMY_PASSWORD_HASH = '$2b$10$HXEoWN38XB0Yp/uWtbEu.u2Zz8FwHhcxACTjzzsJlyZ94NXPzd9V.';

export const isStrongPassword = (value) => {
  if (typeof value !== 'string' || !STRONG_PASSWORD.test(value)) return false;
  return Buffer.byteLength(value) <= PASSWORD_MAX_BYTES;
};

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);

export const verifyPassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);
