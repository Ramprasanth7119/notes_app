import { createRequire } from 'node:module';
import request from 'supertest';

// The server is CommonJS. Loading it through Node's require (instead of a
// Vitest `import`) keeps one shared module cache, so each Mongoose model is
// compiled once. Tests import app code from here, never from ../ directly.
const require = createRequire(import.meta.url);

export const app = require('../app');
export const User = require('../models/User');
export const Note = require('../models/Note');
export const Collection = require('../models/Collection');
export const { assignOrphansTo } = require('../scripts/assignOwner');

// Registers a user and returns a supertest agent that keeps the auth cookie,
// i.e. behaves like a logged-in browser.
export async function signUp(email = 'alice@example.com', password = 'correct horse battery') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ email, password });
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, user: res.body.user };
}

export async function createNote(agent, fields = {}) {
  const res = await agent.post('/api/notes').send({ title: 'A note', content: 'Some content', ...fields });
  if (res.status !== 201) {
    throw new Error(`create note failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

export async function createCollection(agent, fields = {}) {
  const res = await agent.post('/api/collections').send({ name: 'Reading list', ...fields });
  if (res.status !== 201) {
    throw new Error(`create collection failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}
