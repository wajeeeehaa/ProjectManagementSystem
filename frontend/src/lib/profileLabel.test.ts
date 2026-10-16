import { describe, expect, it } from 'vitest';
import { profileDisplayName, profileInitials } from './profileLabel';

describe('profile label', () => {
  it('uses the first and last name for Ali Khan', () => {
    const user = { firstName: 'Ali', lastName: 'Khan', email: 'ali@example.com' };
    expect(profileDisplayName(user)).toBe('Ali Khan');
    expect(profileInitials(user)).toBe('AK');
  });

  it('falls back to the email, then a generic user', () => {
    expect(profileDisplayName({ firstName: ' ', lastName: '', email: 'ada@example.com' })).toBe('ada@example.com');
    expect(profileInitials({ firstName: '', lastName: '', email: 'ada@example.com' })).toBe('A');
    expect(profileDisplayName(null)).toBe('User');
    expect(profileInitials(null)).toBe('U');
    expect(profileDisplayName({ email: ' ' })).toBe('User');
  });

  it('uses a single available name letter', () => {
    expect(profileInitials({ firstName: 'Grace', lastName: '' })).toBe('G');
  });
});
