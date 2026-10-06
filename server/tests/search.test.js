import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, createCollection, createNote, Note, signUp } from './helpers.js';

// GET /api/notes/search runs real MongoDB $text queries against the
// in-memory server; nothing here is filtered in JavaScript.

const search = (agent, query) => agent.get('/api/notes/search').query(query);
const titles = (res) => res.body.results.map((note) => note.title);

let alice;
let bob;

beforeEach(async () => {
  alice = await signUp('alice@example.com');
  bob = await signUp('bob@example.com');
});

describe('text search', () => {
  beforeEach(async () => {
    await createNote(alice.agent, { title: 'Kubernetes basics', content: 'Pods, services and deployments', tags: ['devops'] });
    await createNote(alice.agent, { title: 'Grocery list', content: 'Milk, eggs, coffee' });
    await createNote(alice.agent, { title: 'Morning routine', content: 'Running before work, then coffee' });
  });

  it('matches words in the title or the content', async () => {
    const byTitle = await search(alice.agent, { q: 'kubernetes' });
    expect(byTitle.status).toBe(200);
    expect(titles(byTitle)).toEqual(['Kubernetes basics']);

    const byContent = await search(alice.agent, { q: 'eggs' });
    expect(titles(byContent)).toEqual(['Grocery list']);
  });

  it('is case-insensitive and matches word stems', async () => {
    expect(titles(await search(alice.agent, { q: 'KUBERNETES' }))).toEqual(['Kubernetes basics']);
    // English stemming: "deploy" matches "deployments", "run" matches "Running".
    expect(titles(await search(alice.agent, { q: 'deploy' }))).toEqual(['Kubernetes basics']);
    expect(titles(await search(alice.agent, { q: 'run' }))).toEqual(['Morning routine']);
  });

  it('matches any of several words, and supports "phrases" and -exclusion', async () => {
    const anyWord = await search(alice.agent, { q: 'eggs kubernetes' });
    expect(titles(anyWord).sort()).toEqual(['Grocery list', 'Kubernetes basics']);

    expect(titles(await search(alice.agent, { q: '"before work"' }))).toEqual(['Morning routine']);
    expect(titles(await search(alice.agent, { q: 'coffee -eggs' }))).toEqual(['Morning routine']);
  });

  it('ranks a title match above a content-only match', async () => {
    await createNote(alice.agent, { title: 'Coffee brewing guide', content: 'Grind size and water temperature' });

    const res = await search(alice.agent, { q: 'coffee' });
    expect(res.body.total).toBe(3);
    expect(titles(res)[0]).toBe('Coffee brewing guide');
  });

  it('does not match word prefixes (a known limit of MongoDB $text)', async () => {
    const res = await search(alice.agent, { q: 'kuber' });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('returns an empty page, not an error, when nothing matches', async () => {
    const res = await search(alice.agent, { q: 'zebra' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [], page: 1, limit: 10, total: 0, totalPages: 0 });
  });

  it('treats an empty or blank q as "all of my notes"', async () => {
    for (const q of [undefined, '', '   ']) {
      const res = await search(alice.agent, q === undefined ? {} : { q });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
    }
  });
});

describe('filters', () => {
  let work;
  let reading;

  beforeEach(async () => {
    work = await createCollection(alice.agent, { name: 'Work' });
    reading = await createCollection(alice.agent, { name: 'Reading' });

    const standup = await createNote(alice.agent, { title: 'Standup', content: 'Talked about the release #meeting' });
    const retro = await createNote(alice.agent, { title: 'Retro', content: 'Release went well #meeting #team' });
    const book = await createNote(alice.agent, { title: 'Book notes', content: 'Chapter on release engineering #books' });
    await createNote(alice.agent, { title: 'Loose note', content: 'Nothing about meetings here' });

    for (const note of [standup, retro]) {
      await alice.agent.post(`/api/collections/${work._id}/notes`).send({ noteId: note._id });
    }
    await alice.agent.post(`/api/collections/${reading._id}/notes`).send({ noteId: book._id });
  });

  it('filters by tag alone', async () => {
    const res = await search(alice.agent, { tag: 'meeting' });
    expect(res.status).toBe(200);
    expect(titles(res).sort()).toEqual(['Retro', 'Standup']);
  });

  it('filters by collection alone', async () => {
    const res = await search(alice.agent, { collection: reading._id });
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Book notes']);
  });

  it('combines text, tag and collection with AND', async () => {
    expect(titles(await search(alice.agent, { q: 'release', tag: 'team' }))).toEqual(['Retro']);
    expect(titles(await search(alice.agent, { q: 'release', collection: reading._id }))).toEqual(['Book notes']);
    expect(titles(await search(alice.agent, { q: 'release', tag: 'meeting', collection: work._id })).sort())
      .toEqual(['Retro', 'Standup']);
    // Each filter alone matches something, but not together.
    expect((await search(alice.agent, { q: 'chapter', collection: work._id })).body.total).toBe(0);
  });

  it('returns 404 for a collection id that is not one of the user\'s collections', async () => {
    const res = await search(alice.agent, { collection: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Collection not found' });
  });
});

describe('pagination', () => {
  beforeEach(async () => {
    // Direct insert keeps the setup fast; updatedAt is spread out so the
    // default newest-first order is deterministic.
    const base = Date.UTC(2026, 0, 1);
    await Note.insertMany(
      Array.from({ length: 25 }, (_, i) => ({
        owner: alice.user.id,
        title: `Note ${String(i + 1).padStart(2, '0')}`,
        content: 'paginated content',
        date: '2026-01-01',
        month: 'January',
        createdAt: new Date(base + i * 1000),
        updatedAt: new Date(base + i * 1000)
      })),
      { timestamps: false }
    );
  });

  it('splits results into pages with correct totals and no overlap', async () => {
    const pages = [];
    for (const page of [1, 2, 3]) {
      const res = await search(alice.agent, { q: 'paginated', page: String(page), limit: '10' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page, limit: 10, total: 25, totalPages: 3 });
      pages.push(titles(res));
    }

    expect(pages.map((p) => p.length)).toEqual([10, 10, 5]);
    expect(new Set(pages.flat()).size).toBe(25);
  });

  it('pages through a browse (no q) in newest-first order', async () => {
    const first = await search(alice.agent, { limit: '3' });
    expect(titles(first)).toEqual(['Note 25', 'Note 24', 'Note 23']);
    expect(first.body).toMatchObject({ total: 25, totalPages: 9 });

    const last = await search(alice.agent, { limit: '3', page: '9' });
    expect(titles(last)).toEqual(['Note 01']);
  });

  it('defaults to page 1 with 10 results', async () => {
    const res = await search(alice.agent, {});
    expect(res.body).toMatchObject({ page: 1, limit: 10, total: 25, totalPages: 3 });
    expect(res.body.results).toHaveLength(10);
  });

  it('returns an empty page past the end, with the real total', async () => {
    const res = await search(alice.agent, { page: '4', limit: '10' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [], page: 4, limit: 10, total: 25, totalPages: 3 });
  });

  it.each([
    ['page=0', { page: '0' }, /page must be/],
    ['negative page', { page: '-1' }, /page must be/],
    ['non-numeric page', { page: 'abc' }, /page must be/],
    ['fractional page', { page: '1.5' }, /page must be/],
    ['huge page', { page: '99999999999999999999' }, /page must be/],
    ['limit=0', { limit: '0' }, /limit must be/],
    ['limit above 50', { limit: '51' }, /limit must be/],
    ['massive limit', { limit: '100000' }, /limit must be/],
    ['repeated q', { q: ['a', 'b'] }, /only once/],
    ['overlong q', { q: 'x'.repeat(201) }, /at most 200/],
    ['malformed collection id', { collection: 'nope' }, /valid id/]
  ])('rejects %s with 400', async (_label, query, message) => {
    const res = await search(alice.agent, query);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  it('allows the maximum limit of 50', async () => {
    const res = await search(alice.agent, { limit: '50' });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(25);
  });
});

describe('user isolation', () => {
  it('never returns another user\'s notes, even for identical words and tags', async () => {
    await createNote(alice.agent, { title: 'Alice budget', content: 'quarterly budget #finance' });
    await createNote(bob.agent, { title: 'Bob budget', content: 'quarterly budget #finance' });

    const aliceRes = await search(alice.agent, { q: 'budget', tag: 'finance' });
    expect(titles(aliceRes)).toEqual(['Alice budget']);
    expect(aliceRes.body.total).toBe(1);

    const bobBrowse = await search(bob.agent, {});
    expect(titles(bobBrowse)).toEqual(['Bob budget']);
  });

  it('cannot use another user\'s collection as a filter', async () => {
    const aliceNote = await createNote(alice.agent, { title: 'Secret', content: 'hidden text' });
    const aliceCollection = await createCollection(alice.agent);
    await alice.agent.post(`/api/collections/${aliceCollection._id}/notes`).send({ noteId: aliceNote._id });

    const res = await search(bob.agent, { collection: aliceCollection._id });
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/notes/search').query({ q: 'budget' });
    expect(res.status).toBe(401);
  });
});

describe('index', () => {
  it('uses the owner-prefixed text index for text queries', async () => {
    const indexes = await Note.collection.indexes();
    const textIndex = indexes.find((index) => index.name === 'note_text_search');
    expect(textIndex.key).toMatchObject({ owner: 1, _fts: 'text' });
    expect(textIndex.weights).toEqual({ title: 5, content: 1 });

    await createNote(alice.agent, { title: 'Indexed', content: 'something' });
    const plan = await Note.find({ owner: alice.user.id, $text: { $search: 'indexed' } }).explain('queryPlanner');
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain('note_text_search');
  });

  it('cannot run a text query without an owner (scoping is enforced by the index)', async () => {
    await expect(Note.find({ $text: { $search: 'anything' } }).exec()).rejects.toThrow(/text index/i);
  });
});
