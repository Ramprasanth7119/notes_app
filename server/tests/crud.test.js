import { beforeEach, describe, expect, it } from 'vitest';
import { Collection, createCollection, createNote, expectError, Note, signUp } from './helpers.js';

// Happy-path behaviour of every notes and collections endpoint, checked
// against both the HTTP response and what is stored in MongoDB.

let alice;

beforeEach(async () => {
  alice = await signUp('alice@example.com');
});

describe('notes', () => {
  it('POST creates a note with derived fields', async () => {
    const res = await alice.agent.post('/api/notes').send({ content: '## Trip plan\nPack the bags and book tickets' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, message: 'Note created successfully' });

    const stored = await Note.findById(res.body.data._id).lean();
    expect(stored).toMatchObject({
      title: 'Trip plan', // first line without the markdown heading marks
      content: '## Trip plan\nPack the bags and book tickets',
      pinned: false,
      wordCount: 8,
      readingTime: 1,
      tags: [],
      mediaFiles: []
    });
    expect(stored.owner.toString()).toBe(alice.user.id);
    expect(stored.date).toBe(new Date().toISOString().split('T')[0]);
    expect(stored.month).toBe(new Date().toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }));
    expect(stored.createdAt).toBeInstanceOf(Date);
  });

  it('POST limits a derived title to 100 characters and computes reading time', async () => {
    const longLine = 'word '.repeat(450).trim(); // 450 words on one line
    const note = await createNote(alice.agent, { title: undefined, content: longLine });

    expect(note.title).toHaveLength(100);
    expect(note.wordCount).toBe(450);
    expect(note.readingTime).toBe(3); // ceil(450 / 200)
  });

  it('GET lists the user\'s notes, pinned first', async () => {
    const a = await createNote(alice.agent, { title: 'A', date: '2026-01-01' });
    const b = await createNote(alice.agent, { title: 'B', date: '2026-03-01' });
    await createNote(alice.agent, { title: 'C', date: '2026-02-01' });
    await alice.agent.patch(`/api/notes/${a._id}/pin`);

    const res = await alice.agent.get('/api/notes');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, count: 3 });
    expect(res.body.data.map((n) => n.title)).toEqual(['A', 'B', 'C']);
    expect(res.body.data[1]._id).toBe(b._id);
  });

  it('GET /:id returns one note', async () => {
    const note = await createNote(alice.agent, { title: 'One', content: 'Body' });
    const res = await alice.agent.get(`/api/notes/${note._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ _id: note._id, title: 'One', content: 'Body' });
  });

  it('PUT updates title, content and tags and bumps updatedAt', async () => {
    const note = await createNote(alice.agent, { title: 'Old', content: 'old body', tags: ['a'] });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const res = await alice.agent
      .put(`/api/notes/${note._id}`)
      .send({ title: 'New', content: 'new body text', tags: ['b'] });

    expect(res.status).toBe(200);
    const stored = await Note.findById(note._id).lean();
    expect(stored).toMatchObject({ title: 'New', content: 'new body text', tags: ['b'], wordCount: 3 });
    expect(stored.updatedAt.getTime()).toBeGreaterThan(new Date(note.updatedAt).getTime());
  });

  it('DELETE removes the note', async () => {
    const note = await createNote(alice.agent);

    const res = await alice.agent.delete(`/api/notes/${note._id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await Note.findById(note._id)).toBeNull();

    expectError(await alice.agent.get(`/api/notes/${note._id}`), 404, 'NOT_FOUND');
    expectError(await alice.agent.delete(`/api/notes/${note._id}`), 404, 'NOT_FOUND');
  });

  it('PATCH /:id/pin toggles pinned', async () => {
    const note = await createNote(alice.agent);

    expect((await alice.agent.patch(`/api/notes/${note._id}/pin`)).body.pinned).toBe(true);
    expect((await Note.findById(note._id).lean()).pinned).toBe(true);
    expect((await alice.agent.patch(`/api/notes/${note._id}/pin`)).body.pinned).toBe(false);
  });

  it('GET /month/:month and /date/:date find notes by their date fields', async () => {
    await createNote(alice.agent, { title: 'Feb', date: '2026-02-10' });
    await createNote(alice.agent, { title: 'Mar', date: '2026-03-05' });

    const byMonth = await alice.agent.get('/api/notes/month/February');
    expect(byMonth.body.map((n) => n.title)).toEqual(['Feb']);

    const byDate = await alice.agent.get('/api/notes/date/2026-03-05');
    expect(byDate.status).toBe(200);
    expect(byDate.body.title).toBe('Mar');

    expectError(await alice.agent.get('/api/notes/date/2026-04-01'), 404, 'NOT_FOUND');
  });

  it('GET /stats aggregates the user\'s notes', async () => {
    await createNote(alice.agent, { content: 'a b c #x' });
    await createNote(alice.agent, { content: 'd e #x #y' });

    const res = await alice.agent.get('/api/notes/stats');

    expect(res.status).toBe(200);
    const thisMonth = new Date().getUTCMonth() + 1;
    expect(res.body.monthlyStats).toEqual([{ _id: thisMonth, count: 2 }]);
    expect(res.body.tagStats).toEqual([{ _id: 'x', count: 2 }, { _id: 'y', count: 1 }]);
    // The stats endpoint counts space-separated tokens, hashtags included.
    expect(res.body.wordCountStats).toMatchObject({ avgWordCount: 4, maxWordCount: 4, totalWords: 8 });
  });

  it('GET /stats returns zeros for a user with no notes', async () => {
    const res = await alice.agent.get('/api/notes/stats');
    expect(res.body).toEqual({
      monthlyStats: [],
      tagStats: [],
      wordCountStats: { avgWordCount: 0, maxWordCount: 0, totalWords: 0 }
    });
  });
});

describe('collections', () => {
  it('POST creates a collection', async () => {
    const res = await alice.agent.post('/api/collections').send({ name: '  Recipes  ' });

    expect(res.status).toBe(201);
    const stored = await Collection.findById(res.body._id).lean();
    expect(stored).toMatchObject({ name: 'Recipes', description: '', notes: [] });
    expect(stored.owner.toString()).toBe(alice.user.id);
  });

  it('GET lists collections, most recently updated first, with their notes', async () => {
    const note = await createNote(alice.agent, { title: 'Pasta' });
    const older = await createCollection(alice.agent, { name: 'Older' });
    await createCollection(alice.agent, { name: 'Newer' });
    await alice.agent.post(`/api/collections/${older._id}/notes`).send({ noteId: note._id });

    const res = await alice.agent.get('/api/collections');

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.name)).toEqual(['Older', 'Newer']); // Older was just updated
    expect(res.body[0].notes.map((n) => n.title)).toEqual(['Pasta']);
  });

  it('GET /:id returns the collection with populated notes', async () => {
    const note = await createNote(alice.agent, { title: 'Inside' });
    const collection = await createCollection(alice.agent, { name: 'Box', description: 'Things' });
    await alice.agent.post(`/api/collections/${collection._id}/notes`).send({ noteId: note._id });

    const res = await alice.agent.get(`/api/collections/${collection._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Box', description: 'Things' });
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0]).toMatchObject({ _id: note._id, title: 'Inside' });
  });

  it('PUT updates only the fields sent', async () => {
    const collection = await createCollection(alice.agent, { name: 'Name', description: 'Old' });

    const res = await alice.agent.put(`/api/collections/${collection._id}`).send({ description: 'New' });

    expect(res.status).toBe(200);
    expect(await Collection.findById(collection._id).lean()).toMatchObject({ name: 'Name', description: 'New' });
  });

  it('adding the same note twice stores it once', async () => {
    const note = await createNote(alice.agent);
    const collection = await createCollection(alice.agent);

    await alice.agent.post(`/api/collections/${collection._id}/notes`).send({ noteId: note._id });
    const res = await alice.agent.post(`/api/collections/${collection._id}/notes`).send({ noteId: note._id });

    expect(res.status).toBe(200);
    expect((await Collection.findById(collection._id).lean()).notes.map(String)).toEqual([note._id]);
  });

  it('DELETE /:id/notes/:noteId removes the note from the collection only', async () => {
    const note = await createNote(alice.agent);
    const collection = await createCollection(alice.agent);
    await alice.agent.post(`/api/collections/${collection._id}/notes`).send({ noteId: note._id });

    const res = await alice.agent.delete(`/api/collections/${collection._id}/notes/${note._id}`);

    expect(res.status).toBe(200);
    expect(res.body.notes).toEqual([]);
    expect(await Note.findById(note._id)).not.toBeNull();
  });

  it('DELETE /:id removes the collection', async () => {
    const collection = await createCollection(alice.agent);

    expect((await alice.agent.delete(`/api/collections/${collection._id}`)).status).toBe(204);
    expect(await Collection.findById(collection._id)).toBeNull();
    expectError(await alice.agent.get(`/api/collections/${collection._id}`), 404, 'NOT_FOUND');
  });

  it('adding a note to a collection that does not exist returns 404', async () => {
    const note = await createNote(alice.agent);
    const res = await alice.agent.post('/api/collections/0123456789abcdef01234567/notes').send({ noteId: note._id });

    expectError(res, 404, 'NOT_FOUND', 'Collection not found');
  });
});
