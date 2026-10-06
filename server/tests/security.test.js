import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, expectError, signUp } from './helpers.js';

// Hardening added after the security review.

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('login rate limiting', () => {
  it('blocks an account after 10 failed logins, even with the right password', async () => {
    await signUp('target@example.com', 'the real password');

    for (let i = 0; i < 10; i++) {
      expectError(await login('target@example.com', `guess ${i}`), 401, 'INVALID_CREDENTIALS');
    }

    const blocked = await login('target@example.com', 'the real password');
    expectError(blocked, 429, 'TOO_MANY_REQUESTS', /Too many failed login attempts/);
    expect(blocked.headers['set-cookie']).toBeUndefined();
    expect(blocked.headers.ratelimit).toBeDefined();

    // The same email in different case is the same account and stays blocked.
    expectError(await login('TARGET@example.com', 'the real password'), 429, 'TOO_MANY_REQUESTS');
  });

  it('does not affect other accounts', async () => {
    await signUp('victim@example.com', 'victim password');
    await signUp('other@example.com', 'other password');
    for (let i = 0; i < 10; i++) {
      await login('victim@example.com', 'wrong');
    }

    const res = await login('other@example.com', 'other password');
    expect(res.status).toBe(200);
  });

  it('does not count successful logins', async () => {
    await signUp('regular@example.com', 'regular password');
    for (let i = 0; i < 12; i++) {
      expect((await login('regular@example.com', 'regular password')).status).toBe(200);
    }
  });
});

describe('security headers', () => {
  it('sets helmet headers and hides the framework', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
