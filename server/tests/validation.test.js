import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Collection, createCollection, createNote, errorFields, expectError, Note, signUp } from './helpers.js';

// Every request body, query and path parameter is checked by a Zod schema
// before the handler runs. Each case asserts the 400 response *and* that
// nothing was written.

const uploadedFiles = () => fs.readdirSync(process.env.UPLOAD_DIR);

let alice;

beforeEach(async () => {
  alice = await signUp('alice@example.com');
});

describe('POST /api/notes', () => {
  it.each([
    ['missing content', {}, 'body.content'],
    ['blank content', { content: '   \n ' }, 'body.content'],
    ['non-string content', { content: 42 }, 'body.content'],
    ['overlong title', { content: 'x', title: 't'.repeat(201) }, 'body.title'],
    ['tags that are not an array', { content: 'x', tags: 'a,b' }, 'body.tags'],
    ['a tag that is too long', { content: 'x', tags: ['t'.repeat(51)] }, 'body.tags.0'],
    ['a malformed date', { content: 'x', date: '06/10/2026' }, 'body.date'],
    ['an impossible date', { content: 'x', date: '2026-13-45' }, 'body.date'],
    ['a javascript: source URL', { content: 'x', sources: [{ title: 'x', url: 'javascript:alert(1)' }] }, 'body.sources.0.url'],
    ['a source without a title', { content: 'x', sources: [{ url: 'https://example.com' }] }, 'body.sources.0.title']
  ])('rejects %s', async (_label, body, field) => {
    const res = await alice.agent.post('/api/notes').send(body);

    expectError(res, 400, 'VALIDATION_ERROR', 'Request validation failed');
    expect(errorFields(res)).toEqual([field]);
    expect(await Note.countDocuments()).toBe(0);
  });

  it('reports every invalid field at once', async () => {
    const res = await alice.agent.post('/api/notes').send({ title: 't'.repeat(201), date: 'nope' });
    expect(errorFields(res).sort()).toEqual(['body.content', 'body.date', 'body.title']);
  });

  it('cleans tags and ignores fields the client may not set', async () => {
    const res = await alice.agent.post('/api/notes').send({
      title: '  Padded title  ',
      content: 'body',
      tags: ['work', '', ' work ', 'ideas'],
      owner: '0123456789abcdef01234567',
      pinned: true,
      wordCount: 9999,
      mediaFiles: [{ filename: 'x', path: '/../../etc/passwd', type: 'text' }]
    });

    expect(res.status).toBe(201);
    const stored = await Note.findById(res.body.data._id).lean();
    expect(stored.title).toBe('Padded title');
    expect(stored.tags).toEqual(['work', 'ideas']);
    expect(stored.owner.toString()).toBe(alice.user.id);
    expect(stored.pinned).toBe(false);
    expect(stored.wordCount).toBe(1);
    expect(stored.mediaFiles).toEqual([]);
  });

  it('derives the month from a given date and keeps valid sources', async () => {
    const res = await alice.agent.post('/api/notes').send({
      content: 'x',
      date: '2026-02-14',
      sources: [{ title: 'MDN', url: 'https://developer.mozilla.org' }]
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ date: '2026-02-14', month: 'February' });
    expect(res.body.data.sources).toMatchObject([{ title: 'MDN', url: 'https://developer.mozilla.org' }]);
  });
});

describe('PUT /api/notes/:id', () => {
  let note;

  beforeEach(async () => {
    note = await createNote(alice.agent, { title: 'Original', content: 'Original body', tags: ['keep'] });
  });

  it.each([
    ['an empty title', { title: '' }, 'body.title'],
    ['blank content', { content: '  ' }, 'body.content'],
    ['non-array tags', { tags: 'x' }, 'body.tags']
  ])('rejects %s and leaves the note unchanged', async (_label, body, field) => {
    const res = await alice.agent.put(`/api/notes/${note._id}`).send(body);

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(errorFields(res)).toEqual([field]);
    const stored = await Note.findById(note._id).lean();
    expect(stored).toMatchObject({ title: 'Original', content: 'Original body', tags: ['keep'] });
  });

  it('accepts the whole note document (as the existing UI sends it) but only applies editable fields', async () => {
    const res = await alice.agent.put(`/api/notes/${note._id}`).send({
      ...note,
      title: 'Edited',
      owner: '0123456789abcdef01234567',
      pinned: true,
      mediaFiles: [{ filename: 'x', path: '/x', type: 'text' }]
    });

    expect(res.status).toBe(200);
    const stored = await Note.findById(note._id).lean();
    expect(stored.title).toBe('Edited');
    expect(stored.owner.toString()).toBe(alice.user.id);
    expect(stored.pinned).toBe(false);
    expect(stored.mediaFiles).toEqual([]);
  });

  it('auto-tags #hashtags added while editing and updates word stats', async () => {
    const res = await alice.agent.put(`/api/notes/${note._id}`).send({ content: 'Now about #testing things' });

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(['keep', 'testing']);
    expect(res.body.wordCount).toBe(3);
  });

  it('treats an empty body as a no-op', async () => {
    const res = await alice.agent.put(`/api/notes/${note._id}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Original');
  });
});

describe('collections', () => {
  it.each([
    ['a missing name', {}, 'body.name'],
    ['a blank name', { name: '   ' }, 'body.name'],
    ['an overlong name', { name: 'n'.repeat(101) }, 'body.name'],
    ['a non-string description', { name: 'ok', description: 5 }, 'body.description']
  ])('POST rejects %s', async (_label, body, field) => {
    const res = await alice.agent.post('/api/collections').send(body);

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(errorFields(res)).toEqual([field]);
    expect(await Collection.countDocuments()).toBe(0);
  });

  it('PUT rejects an empty name and keeps the old one', async () => {
    const collection = await createCollection(alice.agent, { name: 'Keep me' });
    const res = await alice.agent.put(`/api/collections/${collection._id}`).send({ name: '' });

    expectError(res, 400, 'VALIDATION_ERROR');
    expect((await Collection.findById(collection._id).lean()).name).toBe('Keep me');
  });

  it.each([
    ['a missing noteId', {}],
    ['a malformed noteId', { noteId: 'abc' }],
    ['a query-operator noteId', { noteId: { $ne: null } }]
  ])('adding a note rejects %s', async (_label, body) => {
    const collection = await createCollection(alice.agent);
    const res = await alice.agent.post(`/api/collections/${collection._id}/notes`).send(body);

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(errorFields(res)).toEqual(['body.noteId']);
  });
});

describe('path parameters', () => {
  it.each([
    ['GET', '/api/notes/123', 'params.id'],
    ['PUT', '/api/notes/zzzzzzzzzzzzzzzzzzzzzzzz', 'params.id'],
    ['DELETE', '/api/notes/not-an-id', 'params.id'],
    ['GET', '/api/notes/0123456789abcdef01234567/files/bad', 'params.fileId'],
    ['GET', '/api/notes/date/yesterday', 'params.date'],
    ['GET', '/api/collections/123', 'params.id'],
    ['DELETE', '/api/collections/0123456789abcdef01234567/notes/bad', 'params.noteId']
  ])('%s %s rejects the malformed id', async (method, url, field) => {
    const res = await alice.agent[method.toLowerCase()](url).send({});

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(errorFields(res)).toEqual([field]);
  });
});

describe('POST /api/notes/:id/upload', () => {
  let note;

  beforeEach(async () => {
    note = await createNote(alice.agent);
  });

  const upload = (buffer, filename, contentType) =>
    alice.agent.post(`/api/notes/${note._id}/upload`).attach('media', buffer, { filename, contentType });

  it.each([
    ['an HTML file', 'page.html', 'text/html'],
    ['an SVG image', 'logo.svg', 'image/svg+xml'],
    ['an executable', 'tool.exe', 'application/octet-stream'],
    ['a .png whose type is really HTML', 'cat.png', 'text/html']
  ])('rejects %s with 415 and writes nothing', async (_label, filename, contentType) => {
    const before = uploadedFiles();
    const res = await upload(Buffer.from('<script>alert(1)</script>'), filename, contentType);

    expectError(res, 415, 'UNSUPPORTED_FILE_TYPE');
    expect(uploadedFiles()).toEqual(before);
    expect((await Note.findById(note._id).lean()).mediaFiles).toEqual([]);
  });

  it('rejects a file over 5 MB with 413 and removes the partial upload', async () => {
    const before = uploadedFiles();
    const res = await upload(Buffer.alloc(5 * 1024 * 1024 + 1), 'big.txt', 'text/plain');

    expectError(res, 413, 'FILE_TOO_LARGE');
    expect(uploadedFiles()).toEqual(before);
    expect((await Note.findById(note._id).lean()).mediaFiles).toEqual([]);
  });

  it('accepts an allowed type of exactly 5 MB', async () => {
    const res = await upload(Buffer.alloc(5 * 1024 * 1024), 'notes.pdf', 'application/pdf');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ filename: 'notes.pdf', type: 'application' });
  });

  it('rejects a request without a file', async () => {
    const res = await alice.agent.post(`/api/notes/${note._id}/upload`).field('media', 'not a file');

    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('rejects a file sent under the wrong field name', async () => {
    const res = await alice.agent
      .post(`/api/notes/${note._id}/upload`)
      .attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });

    expectError(res, 400, 'VALIDATION_ERROR');
  });
});
