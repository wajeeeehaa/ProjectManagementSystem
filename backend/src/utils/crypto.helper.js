import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');

export const hmacSha256 = (value, secret) =>
  createHmac('sha256', secret).update(String(value)).digest('hex');

export const digestEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const randomOtp = () => randomInt(0, 1_000_000).toString().padStart(6, '0');
