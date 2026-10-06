import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, Note, signUp, User } from './helpers.js';

const EMAIL = 'alice@example.com';
const PASSWORD = 'correct horse battery';

const authCookie = (res) =>
  (res.headers['set-cookie'] || []).find((cookie) => cookie.startsWith('token='));

describe('POST /api/auth/register', () => {
  it('creates the user, stores only a bcrypt hash, and sets an httpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: EMAIL });
    expect(res.body.user.id).toMatch(/^[a-f\d]{24}$/);
    // Neither the token nor the hash is ever part of the JSON body.
    expect(JSON.stringify(res.body)).not.toMatch(/token|passwordHash|\$2[aby]\$/);

    const cookie = authCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=604800/); // 7 days

    const stored = await User.findOne({ email: EMAIL }).select('+passwordHash').lean();
    expect(stored.passwordHash).not.toBe(PASSWORD);
    expect(stored.passwordHash).toMatch(/^\$2b\$04\$/); // bcrypt, cost from BCRYPT_SALT_ROUNDS
    expect(await bcrypt.compare(PASSWORD, stored.passwordHash)).toBe(true);
    expect(stored.createdAt).toBeInstanceOf(Date);
    expect(stored.updatedAt).toBeInstanceOf(Date);
  });

  it('normalises the email so the same address cannot register twice', async () => {
    await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: '  ALICE@Example.com ', password: 'another password' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/);
    expect(authCookie(res)).toBeUndefined();
    expect(await User.countDocuments()).toBe(1);
  });

  it.each([
    ['missing email', { password: PASSWORD }, /required/],
    ['missing password', { email: EMAIL }, /required/],
    ['empty body', {}, /required/],
    ['non-string password', { email: EMAIL, password: 12345678 }, /required/],
    ['invalid email', { email: 'not-an-email', password: PASSWORD }, /not valid/],
    ['short password', { email: EMAIL, password: 'short' }, /at least 8/],
    ['password over 72 bytes', { email: EMAIL, password: 'é'.repeat(37) }, /at most 72 bytes/]
  ])('rejects %s with 400 and creates nothing', async (_label, body, message) => {
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
    expect(authCookie(res)).toBeUndefined();
    expect(await User.countDocuments()).toBe(0);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right password and sets the cookie', async () => {
    await signUp(EMAIL, PASSWORD);
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
    expect(JSON.stringify(res.body)).not.toMatch(/token|passwordHash/);
    expect(authCookie(res)).toMatch(/HttpOnly/);

    const { sub } = jwt.verify(authCookie(res).split(';')[0].slice('token='.length), process.env.JWT_SECRET);
    expect(sub).toBe(res.body.user.id);
  });

  it('rejects a wrong password with 401 and no cookie', async () => {
    await signUp(EMAIL, PASSWORD);
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: 'wrong password' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
    expect(authCookie(res)).toBeUndefined();
  });

  it('gives an unknown email the same response as a wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it.each([
    ['missing password', { email: EMAIL }],
    ['missing email', { password: PASSWORD }],
    ['empty body', {}]
  ])('rejects %s with 400', async (_label, body) => {
    const res = await request(app).post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/);
  });
});

describe('session cookie', () => {
  it('lets an authenticated request through and identifies the user', async () => {
    const { agent, user } = await signUp(EMAIL, PASSWORD);
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: EMAIL });
  });

  it.each(['/api/auth/me', '/api/notes', '/api/notes/stats', '/api/collections'])(
    'rejects GET %s without a cookie',
    async (url) => {
      const res = await request(app).get(url);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    }
  );

  it('rejects writes without a cookie and stores nothing', async () => {
    const res = await request(app).post('/api/notes').send({ title: 'x', content: 'y' });
    expect(res.status).toBe(401);
    expect(await Note.countDocuments()).toBe(0);
  });

  it('rejects a token signed with a different secret', async () => {
    const { user } = await signUp(EMAIL, PASSWORD);
    const forged = jwt.sign({ sub: user.id }, 'attacker-secret');
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or has expired/);
  });

  it('rejects an expired token', async () => {
    const { user } = await signUp(EMAIL, PASSWORD);
    const expired = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${expired}`);

    expect(res.status).toBe(401);
  });

  it('rejects an unsigned ("alg: none") token', async () => {
    const { user } = await signUp(EMAIL, PASSWORD);
    const unsigned = jwt.sign({ sub: user.id }, null, { algorithm: 'none' });
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${unsigned}`);

    expect(res.status).toBe(401);
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const { agent, user } = await signUp(EMAIL, PASSWORD);
    await User.deleteOne({ _id: user.id });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('logout clears the cookie so later requests are unauthenticated', async () => {
    const { agent } = await signUp(EMAIL, PASSWORD);

    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(authCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
