import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../utils/constants.js';
import {
  signRefreshToken,
  verifyAccessToken,
  verifyActivationToken,
  verifyResetToken,
} from '../../utils/jwt.helper.js';

describe('JWT purpose checks', () => {
  it('rejects a refresh token presented as an access token', () => {
    const token = signRefreshToken({ id: 'user-id', fid: 'family-id', jti: 'jti-id' });
    assert.throws(() => verifyAccessToken(token), (error) => error.statusCode === 401);
  });

  it('returns a clear error for an expired activation or reset token', () => {
    const expired = Math.floor(Date.now() / 1000) - 10;
    const activation = jwt.sign(
      { email: 'ada@example.com', otp: '123456', tokenType: 'activation', exp: expired },
      JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const reset = jwt.sign(
      { email: 'ada@example.com', tokenType: 'reset', exp: expired },
      JWT_SECRET,
      { algorithm: 'HS256' },
    );

    assert.throws(
      () => verifyActivationToken(activation),
      (error) => error.statusCode === 400 && error.message === 'Activation link has expired',
    );
    assert.throws(
      () => verifyResetToken(reset),
      (error) => error.statusCode === 400 && error.message === 'Reset link has expired',
    );
  });
});
