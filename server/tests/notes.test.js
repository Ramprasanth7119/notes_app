import { beforeEach, describe, expect, it } from 'vitest';
import { Note, signUp } from './helpers.js';

let alice;

beforeEach(async () => {
  alice = await signUp('alice@example.com');
});

describe('hashtag auto-tagging', () => {
  it('merges #hashtags from the content with the tags sent by the client', async () => {
    const res = await alice.agent
      .post('/api/notes')
      .send({ title: 'Stack', content: 'Learning #react and #node_js today', tags: ['work', 'react'] });

    expect(res.status).toBe(201);
    expect(res.body.data.tags).toEqual(['work', 'react', 'node_js']);
    const stored = await Note.findById(res.body.data._id).lean();
    expect(stored.tags).toEqual(['work', 'react', 'node_js']);
  });

  it('does not crash on markdown headings (previously a 500)', async () => {
    const res = await alice.agent
      .post('/api/notes')
      .send({ content: '# Weekly review\n\nShipped the #auth work' });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Weekly review'); // derived from the first line
    expect(res.body.data.tags).toEqual(['auth']);
  });
});

describe('bad input', () => {
  it('returns 400, not 500, for malformed JSON', async () => {
    const res = await alice.agent
      .post('/api/notes')
      .set('Content-Type', 'application/json')
      .send('{"content": ');

    expect(res.status).toBe(400);
  });

  it('returns 400, not 500, when a field has the wrong type', async () => {
    const note = (await alice.agent.post('/api/notes').send({ title: 'T', content: 'C' })).body.data;
    const res = await alice.agent.put(`/api/notes/${note._id}`).send({ title: { $gt: '' } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid request data' });
    expect((await Note.findById(note._id).lean()).title).toBe('T');
  });
});
