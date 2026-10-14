import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../../utils/password.helper.js';

describe('password policy', () => {
  it('accepts a password with every required class', () => {
    assert.equal(isStrongPassword('Str0ng!Pass'), true);
  });

  it('rejects passwords that miss a required class or are too long for bcrypt', () => {
    assert.equal(isStrongPassword('short1!A'), true);
    assert.equal(isStrongPassword('noupper1!'), false);
    assert.equal(isStrongPassword('NOLOWER1!'), false);
    assert.equal(isStrongPassword('NoDigit!!'), false);
    assert.equal(isStrongPassword('NoSpecial1'), false);
    assert.equal(isStrongPassword('Aa1!'), false);
    assert.equal(isStrongPassword(`${'A'.repeat(70)}a1!`), false);
    assert.equal(PASSWORD_RULE_MESSAGE.includes('special character'), true);
  });
});
