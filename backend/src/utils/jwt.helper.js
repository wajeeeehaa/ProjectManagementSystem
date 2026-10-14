import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import {
  ACCESS_TTL_SECONDS,
  ACTIVATION_TTL_SECONDS,
  HTTP_STATUS,
  JWT_SECRET,
  REFRESH_TTL_SECONDS,
  RESET_TTL_SECONDS,
} from './constants.js';
import { HttpError } from './httpError.js';

const configurationError = (message) => {
  const error = new Error(message);
  error.name = 'JwtConfigurationError';
  return error;
};

const sign = (payload, expiresIn, jwtid) => {
  if (!JWT_SECRET) {
    throw configurationError('JWT_SECRET is empty');
  }
  const options = { algorithm: 'HS256', expiresIn };
  if (jwtid) options.jwtid = jwtid;
  return jwt.sign(payload, JWT_SECRET, options);
};

const invalidMessage = (purpose) => {
  if (purpose === 'activation') return 'Invalid activation link';
  if (purpose === 'reset') return 'Invalid reset link';
  return 'Unauthorized';
};

const expiredMessage = (purpose) => {
  if (purpose === 'activation') return 'Activation link has expired';
  if (purpose === 'reset') return 'Reset link has expired';
  if (purpose === 'refresh') return 'Refresh token has expired';
  return 'Access token has expired';
};

const statusFor = (purpose) =>
  purpose === 'activation' || purpose === 'reset' ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.UNAUTHORIZED;

const verify = (token, purpose) => {
  if (!JWT_SECRET) {
    throw configurationError('JWT_SECRET is empty');
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new HttpError(statusFor(purpose), expiredMessage(purpose));
    }
    throw new HttpError(statusFor(purpose), invalidMessage(purpose));
  }

  if (!payload || typeof payload !== 'object' || payload.tokenType !== purpose) {
    throw new HttpError(statusFor(purpose), invalidMessage(purpose));
  }

  return payload;
};

export const signAccessToken = ({ id, sid }) =>
  sign({ id, tokenType: 'access', sid }, ACCESS_TTL_SECONDS, randomUUID());

export const signRefreshToken = ({ id, fid, jti }) =>
  sign({ id, tokenType: 'refresh', fid }, REFRESH_TTL_SECONDS, jti);

export const signActivationToken = ({ email, otp }) =>
  sign({ email, otp, tokenType: 'activation' }, ACTIVATION_TTL_SECONDS);

export const signResetToken = ({ email }) => sign({ email, tokenType: 'reset' }, RESET_TTL_SECONDS);

const requireFields = (payload, purpose, fields) => {
  for (const field of fields) {
    if (typeof payload[field] !== 'string' || payload[field].trim() === '') {
      throw new HttpError(statusFor(purpose), invalidMessage(purpose));
    }
  }
  if (typeof payload.exp !== 'number') {
    throw new HttpError(statusFor(purpose), invalidMessage(purpose));
  }
  return payload;
};

export const verifyAccessToken = (token) =>
  requireFields(verify(token, 'access'), 'access', ['id', 'sid', 'jti']);

export const verifyRefreshToken = (token) =>
  requireFields(verify(token, 'refresh'), 'refresh', ['id', 'fid', 'jti']);

export const verifyActivationToken = (token) =>
  requireFields(verify(token, 'activation'), 'activation', ['email', 'otp']);

export const verifyResetToken = (token) => requireFields(verify(token, 'reset'), 'reset', ['email']);
