export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters, no more than 72 bytes, and include an uppercase letter, a lowercase letter, a digit, and a special character.';

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function isStrongPassword(value: string): boolean {
  return STRONG_PASSWORD.test(value) && new TextEncoder().encode(value).length <= 72;
}
