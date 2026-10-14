import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { emailRateKey, rateLimit, rateLimitSettings, resetRateLimits } from '../../middlewares/rateLimit.middleware.js';

const mockResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return response;
};

describe('auth rate limits', () => {
  beforeEach(() => {
    resetRateLimits();
    rateLimitSettings.max = 2;
    rateLimitSettings.windowMs = 60_000;
  });

  it('limits repeated attempts for the same IP and normalized email', () => {
    const middleware = rateLimit({ name: 'login', key: emailRateKey });
    const request = {
      ip: '203.0.113.8',
      body: { email: ' Ada@Example.com ' },
    };
    let passed = 0;
    const next = () => {
      passed += 1;
    };

    middleware(request, mockResponse(), next);
    middleware(request, mockResponse(), next);
    const blocked = mockResponse();
    middleware({ ...request, body: { email: 'ada@example.com' } }, blocked, next);

    assert.equal(passed, 2);
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.body.message, 'Too many requests');
    assert.ok(Number(blocked.headers['Retry-After']) > 0);
  });
});
