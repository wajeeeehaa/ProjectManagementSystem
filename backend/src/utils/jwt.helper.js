import './loadEnv.js';
import jwt from 'jsonwebtoken';

const configurationError = (message) => {
  const error = new Error(message);
  error.name = 'JwtConfigurationError';
  return error;
};

/**
 * Verify an access token. Not called during scaffold startup.
 * HS256 uses JWT_SECRET only. RS256 uses JWT_PUBLIC_KEY only.
 * A missing or unsupported algorithm is an error. It is not treated as HMAC.
 */
export const verifyAccessToken = (token) => {
  const algorithm = process.env.JWT_ALGORITHM?.trim() ?? '';

  if (algorithm !== 'HS256' && algorithm !== 'RS256') {
    throw configurationError('JWT_ALGORITHM is empty or unsupported');
  }

  if (algorithm === 'HS256') {
    const secret = process.env.JWT_SECRET?.trim() ?? '';
    if (!secret) {
      throw configurationError('JWT_SECRET is empty');
    }
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  }

  const publicKey = process.env.JWT_PUBLIC_KEY?.trim() ?? '';
  if (!publicKey) {
    throw configurationError('JWT_PUBLIC_KEY is empty');
  }

  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
};
