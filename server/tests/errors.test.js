import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app, expectError, Note, signUp } from './helpers.js';

// Every error, whatever produced it, uses the same JSON shape:
//   { success: false, error: { code, message, details? } }

afterEach(() => {
  vi.restoreAllMocks();
});

describe('unified error responses', () => {
  it('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expectError(res, 404, 'NOT_FOUND', 'Route not found');

    const outsideApi = await request(app).get('/uploads/anything.png');
    expectError(outsideApi, 404, 'NOT_FOUND');
  });

  it('a JSON body over 1 MB returns 413', async () => {
    const { agent } = await signUp();
    const res = await agent.post('/api/notes').send({ content: 'x'.repeat(1024 * 1024 + 1) });

    expectError(res, 413, 'PAYLOAD_TOO_LARGE');
    expect(await Note.countDocuments()).toBe(0);
  });

  it('validation errors list each failing field with a readable message', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [
          { field: 'body.email', message: 'Email address is not valid' },
          { field: 'body.password', message: 'Password must be at least 8 characters' }
        ]
      }
    });
  });

  it('an unexpected failure returns a generic 500 and logs the real error server-side only', async () => {
    const { agent } = await signUp();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Simulate a database failure inside a handler.
    vi.spyOn(Note, 'find').mockImplementation(() => {
      throw new Error('connection to mongodb://admin:hunter2@db lost');
    });

    const res = await agent.get('/api/notes');

    expect(res.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
    });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|mongodb|stack|at /);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][1])).toMatch(/connection to mongodb/);
  });

  it('expected errors (4xx) are not logged as server errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await request(app).get('/api/notes');
    await request(app).post('/api/auth/login').send({});
    expect(log).not.toHaveBeenCalled();
  });
});
