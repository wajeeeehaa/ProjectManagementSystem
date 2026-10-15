import { describe, expect, it } from 'vitest';
import { resolveAuthRedirect } from './authRedirect';
import { readCookie } from './csrf';
import { isStrongPassword } from './passwordPolicy';
import { classifyRefreshLock } from './refreshLock';
import { REFRESH_PATH, shouldAttemptRefresh } from './sessionPolicy';

describe('auth session helpers', () => {
  it('keeps the refresh request on the exact cookie path', () => {
    expect(REFRESH_PATH).toBe('/api/auth/refresh-token');
    expect(REFRESH_PATH.endsWith('/')).toBe(false);
  });

  it('refreshes an expired session once, but not an auth form or a second 401', () => {
    expect(shouldAttemptRefresh('/api/auth/me', 401, true)).toBe(true);
    expect(shouldAttemptRefresh('/api/auth/me', 401, false)).toBe(false);
    expect(shouldAttemptRefresh('/api/auth/login', 401, true)).toBe(false);
    expect(shouldAttemptRefresh(REFRESH_PATH, 401, true)).toBe(false);
    expect(shouldAttemptRefresh('/api/auth/verify/token', 401, true)).toBe(false);
    expect(shouldAttemptRefresh('/api/projects', 403, true)).toBe(false);
  });

  it('sends anonymous users to login and signed-in users away from public auth pages', () => {
    expect(resolveAuthRedirect('/', false)).toBe('/login');
    expect(resolveAuthRedirect('/', true)).toBe('/workspaces');
    expect(resolveAuthRedirect('/dashboard', false)).toBe('/login');
    expect(resolveAuthRedirect('/workspaces/123', false)).toBe('/login');
    expect(resolveAuthRedirect('/login', true)).toBe('/workspaces');
    expect(resolveAuthRedirect('/verify', true)).toBeNull();
    expect(resolveAuthRedirect('/reset-password', false)).toBeNull();
  });

  it('reads the readable CSRF cookie without treating an API-scoped cookie as visible', () => {
    expect(readCookie('csrfToken=abc123; other=no', 'csrfToken')).toBe('abc123');
    expect(readCookie('accessToken=secret', 'csrfToken')).toBeNull();
  });

  it('waits for a fresh cross-tab refresh lock and replaces an expired one', () => {
    expect(classifyRefreshLock(null, 1_000)).toBe('take');
    expect(classifyRefreshLock(JSON.stringify({ expires: 2_000 }), 1_000)).toBe('wait');
    expect(classifyRefreshLock(JSON.stringify({ expires: 500 }), 1_000)).toBe('take');
    expect(classifyRefreshLock('not-json', 1_000)).toBe('take');
  });

  it('matches the account password rule', () => {
    expect(isStrongPassword('Str0ng!Pass')).toBe(true);
    expect(isStrongPassword('password')).toBe(false);
    expect(isStrongPassword(`${'A'.repeat(70)}a1!`)).toBe(false);
  });
});
