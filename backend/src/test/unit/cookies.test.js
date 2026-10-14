import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertRuntimeCookieConfig } from '../../utils/cookieConfig.js';
import { buildAuthCookies, clearAuthCookies } from '../../utils/cookies.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const runBoot = (overrides) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, ['src/test/fixtures/checkBoot.js'], {
      cwd: backendRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        SECURE_COOKIE: 'true',
        SAME_SITE: 'lax',
        ...overrides,
      },
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, stderr }));
  });

describe('cookie configuration', () => {
  it('scopes access, refresh, and CSRF cookies to different paths', () => {
    const [access, refresh, csrf] = buildAuthCookies({
      accessToken: 'access.token.value',
      refreshToken: 'refresh.token.value',
      csrfToken: 'csrf-token',
    });

    assert.match(access, /Path=\/api(;|$)/);
    assert.doesNotMatch(access, /Path=\/api\/auth/);
    assert.match(access, /HttpOnly/);
    assert.match(refresh, /Path=\/api\/auth\/refresh-token(;|$)/);
    assert.match(refresh, /HttpOnly/);
    assert.match(csrf, /Path=\/(;|$)/);
    assert.doesNotMatch(csrf, /HttpOnly/);

    const cleared = clearAuthCookies();
    assert.match(cleared[0], /Max-Age=0/);
    assert.match(cleared[0], /Path=\/api(;|$)/);
    assert.match(cleared[1], /Path=\/api\/auth\/refresh-token(;|$)/);
    assert.match(cleared[2], /Path=\/(;|$)/);
  });

  it('rejects insecure or cross-site production cookie settings', () => {
    assert.throws(
      () => assertRuntimeCookieConfig({ nodeEnv: 'production', secureCookie: 'false', sameSite: 'lax' }),
      /SECURE_COOKIE must be true in production/,
    );
    assert.throws(
      () => assertRuntimeCookieConfig({ nodeEnv: 'production', secureCookie: 'true', sameSite: 'none' }),
      /conflicts with same-origin deployment/,
    );
    assert.throws(
      () => assertRuntimeCookieConfig({ nodeEnv: 'test', secureCookie: 'false', sameSite: 'sideways' }),
      /SAME_SITE must be lax, strict, or none/,
    );
  });

  it('fails process startup for invalid production cookie settings', async () => {
    const insecure = await runBoot({ SECURE_COOKIE: 'false' });
    assert.equal(insecure.code, 1);
    assert.match(insecure.stderr, /SECURE_COOKIE must be true in production/);

    const crossSite = await runBoot({ SAME_SITE: 'none' });
    assert.equal(crossSite.code, 1);
    assert.match(crossSite.stderr, /conflicts with same-origin deployment/);
  });
});
