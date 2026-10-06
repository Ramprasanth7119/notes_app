import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  assignOrphansTo,
  Collection,
  createCollection,
  createNote,
  errorFields,
  expectError,
  Note,
  signUp
} from './helpers.js';

// Alice owns the resources; Bob is a second, fully authenticated user who
// tries to reach them. Every foreign access must look exactly like a missing
// resource (404), and must leave the database untouched.

const uploadedFiles = () => fs.readdirSync(process.env.UPLOAD_DIR);
const missingId = () => new mongoose.Types.ObjectId().toString();

let alice;
let bob;

beforeEach(async () => {
  alice = await signUp('alice@example.com');
  bob = await signUp('bob@example.com');
});

describe('notes', () => {
  let note;

  beforeEach(async () => {
    note = await createNote(alice.agent, { title: 'Alice private', content: 'secret plans #private' });
  });

  it('stores the owner from the session, ignoring an owner sent in the body', async () => {
    const res = await bob.agent.post('/api/notes').send({ title: 'Bob', content: 'hi', owner: alice.user.id });

    expect(res.status).toBe(201);
    const stored = await Note.findById(res.body.data._id).lean();
    expect(stored.owner.toString()).toBe(bob.user.id);
    expect(note.owner).toBe(alice.user.id);
  });

  it('Bob gets the same 404 for Alice\'s note as for a note that does not exist', async () => {
    const foreign = await bob.agent.get(`/api/notes/${note._id}`);
    const missing = await bob.agent.get(`/api/notes/${missingId()}`);

    expectError(foreign, 404, 'NOT_FOUND', 'Note not found');
    expect(foreign.body).toEqual(missing.body);
  });

  it('Bob cannot update Alice\'s note', async () => {
    const res = await bob.agent.put(`/api/notes/${note._id}`).send({ title: 'pwned', content: 'pwned' });

    expect(res.status).toBe(404);
    const stored = await Note.findById(note._id).lean();
    expect(stored.title).toBe('Alice private');
    expect(stored.content).toBe('secret plans #private');
  });

  it('Bob cannot delete or pin Alice\'s note', async () => {
    expect((await bob.agent.delete(`/api/notes/${note._id}`)).status).toBe(404);
    expect((await bob.agent.patch(`/api/notes/${note._id}/pin`)).status).toBe(404);

    const stored = await Note.findById(note._id).lean();
    expect(stored).not.toBeNull();
    expect(stored.pinned).toBe(false);
  });

  it('Bob\'s list, search, date lookup and stats never include Alice\'s note', async () => {
    const list = await bob.agent.get('/api/notes');
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(0);
    expect(list.body.data).toEqual([]);

    const search = await bob.agent.get('/api/notes/search').query({ q: 'secret' });
    expect(search.status).toBe(200);
    expect(search.body.results).toEqual([]);
    expect(search.body.total).toBe(0);

    expect((await bob.agent.get(`/api/notes/date/${note.date}`)).status).toBe(404);
    expect((await bob.agent.get(`/api/notes/month/${note.month}`)).body).toEqual([]);

    const stats = await bob.agent.get('/api/notes/stats');
    expect(stats.body.monthlyStats).toEqual([]);
    expect(stats.body.tagStats).toEqual([]);
  });

  it('Alice can read, update, pin, find and delete her own note', async () => {
    const read = await alice.agent.get(`/api/notes/${note._id}`);
    expect(read.status).toBe(200);
    expect(read.body.title).toBe('Alice private');

    const updated = await alice.agent.put(`/api/notes/${note._id}`).send({ title: 'Renamed' });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('Renamed');
    expect(updated.body.content).toBe('secret plans #private'); // untouched

    const pinned = await alice.agent.patch(`/api/notes/${note._id}/pin`);
    expect(pinned.body.pinned).toBe(true);

    const search = await alice.agent.get('/api/notes/search').query({ q: 'secret' });
    expect(search.body.results.map((n) => n._id)).toEqual([note._id]);

    const stats = await alice.agent.get('/api/notes/stats');
    expect(stats.body.tagStats).toEqual([{ _id: 'private', count: 1 }]);

    expect((await alice.agent.delete(`/api/notes/${note._id}`)).status).toBe(204);
    expect(await Note.findById(note._id)).toBeNull();
  });

  it('rejects a malformed id with 400 instead of a server error', async () => {
    const res = await alice.agent.get('/api/notes/not-an-id');
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(errorFields(res)).toEqual(['params.id']);
  });
});

describe('attachments', () => {
  let note;
  let file;

  beforeEach(async () => {
    note = await createNote(alice.agent);
    const res = await alice.agent
      .post(`/api/notes/${note._id}/upload`)
      .attach('media', Buffer.from('alice attachment'), 'alice.txt');
    expect(res.status).toBe(200);
    file = res.body;
  });

  it('Alice can download her attachment', async () => {
    const res = await alice.agent.get(`/api/notes/${note._id}/files/${file._id}`);

    expect(res.status).toBe(200);
    expect(res.text).toBe('alice attachment');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('Bob cannot download, delete or upload to Alice\'s note', async () => {
    const before = uploadedFiles();

    expect((await bob.agent.get(`/api/notes/${note._id}/files/${file._id}`)).status).toBe(404);
    expect((await bob.agent.delete(`/api/notes/${note._id}/files/${file._id}`)).status).toBe(404);
    const upload = await bob.agent
      .post(`/api/notes/${note._id}/upload`)
      .attach('media', Buffer.from('bob was here'), 'bob.txt');
    expect(upload.status).toBe(404);

    // Nothing was removed and Bob's upload was never written to disk.
    expect(uploadedFiles()).toEqual(before);
    const stored = await Note.findById(note._id).lean();
    expect(stored.mediaFiles).toHaveLength(1);
  });

  it('uploaded files are not served from a public static path', async () => {
    const res = await bob.agent.get(`/uploads${file.path}`);
    expect(res.status).toBe(404);
  });

  it('deleting the note removes its files from disk', async () => {
    const diskName = path.basename(file.path);
    expect(uploadedFiles()).toContain(diskName);

    await alice.agent.delete(`/api/notes/${note._id}`);
    expect(uploadedFiles()).not.toContain(diskName);
  });
});

describe('collections', () => {
  let collection;
  let aliceNote;

  beforeEach(async () => {
    aliceNote = await createNote(alice.agent, { title: 'In collection' });
    collection = await createCollection(alice.agent, { name: 'Alice stuff' });
    const added = await alice.agent.post(`/api/collections/${collection._id}/notes`).send({ noteId: aliceNote._id });
    expect(added.status).toBe(200);
  });

  it('Bob cannot read Alice\'s collection, and his list does not include it', async () => {
    const foreign = await bob.agent.get(`/api/collections/${collection._id}`);
    expectError(foreign, 404, 'NOT_FOUND', 'Collection not found');

    const list = await bob.agent.get('/api/collections');
    expect(list.body).toEqual([]);
  });

  it('Bob cannot rename, delete, or change the notes of Alice\'s collection', async () => {
    const bobNote = await createNote(bob.agent);

    expect((await bob.agent.put(`/api/collections/${collection._id}`).send({ name: 'pwned' })).status).toBe(404);
    expect((await bob.agent.post(`/api/collections/${collection._id}/notes`).send({ noteId: bobNote._id })).status).toBe(404);
    expect((await bob.agent.delete(`/api/collections/${collection._id}/notes/${aliceNote._id}`)).status).toBe(404);
    expect((await bob.agent.delete(`/api/collections/${collection._id}`)).status).toBe(404);

    const stored = await Collection.findById(collection._id).lean();
    expect(stored.name).toBe('Alice stuff');
    expect(stored.notes.map(String)).toEqual([aliceNote._id]);
  });

  it('Bob cannot put Alice\'s note into his own collection', async () => {
    const bobCollection = await createCollection(bob.agent, { name: 'Bob stuff' });
    const res = await bob.agent.post(`/api/collections/${bobCollection._id}/notes`).send({ noteId: aliceNote._id });

    expectError(res, 404, 'NOT_FOUND', 'Note not found');
    const stored = await Collection.findById(bobCollection._id).lean();
    expect(stored.notes).toEqual([]);
  });

  it('a foreign note id that slipped into a collection is never populated', async () => {
    // Simulate legacy data: Bob's collection directly references Alice's note.
    const bobCollection = await createCollection(bob.agent);
    await Collection.updateOne({ _id: bobCollection._id }, { $push: { notes: aliceNote._id } });

    const res = await bob.agent.get(`/api/collections/${bobCollection._id}`);
    expect(res.status).toBe(200);
    expect(res.body.notes).toEqual([]);
  });

  it('Alice can read, rename, remove notes from and delete her collection', async () => {
    const read = await alice.agent.get(`/api/collections/${collection._id}`);
    expect(read.status).toBe(200);
    expect(read.body.notes.map((n) => n.title)).toEqual(['In collection']);

    const renamed = await alice.agent.put(`/api/collections/${collection._id}`).send({ name: 'Renamed' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Renamed');

    const removed = await alice.agent.delete(`/api/collections/${collection._id}/notes/${aliceNote._id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.notes).toEqual([]);

    expect((await alice.agent.delete(`/api/collections/${collection._id}`)).status).toBe(204);
    expect(await Collection.findById(collection._id)).toBeNull();
    // Deleting a collection keeps its notes.
    expect(await Note.findById(aliceNote._id)).not.toBeNull();
  });

  it('deleting a note removes it from the owner\'s collections', async () => {
    await alice.agent.delete(`/api/notes/${aliceNote._id}`);

    const stored = await Collection.findById(collection._id).lean();
    expect(stored.notes).toEqual([]);
  });
});

describe('legacy data migration', () => {
  it('assigns documents created before authentication to one user, and only those', async () => {
    const owned = await createNote(bob.agent, { title: 'Bob already owns this' });
    // Pre-auth documents have no owner field; insert them bypassing the schema.
    await Note.collection.insertOne({ title: 'Old note', content: 'from before auth', date: '2025-06-01', month: 'June', tags: [] });
    await Collection.collection.insertOne({ name: 'Old collection', notes: [] });

    // Unowned data is invisible to everyone until it is migrated.
    expect((await alice.agent.get('/api/notes')).body.count).toBe(0);

    const changed = await assignOrphansTo(alice.user.id);
    expect(changed).toEqual({ notes: 1, collections: 1 });

    const aliceNotes = (await alice.agent.get('/api/notes')).body.data;
    expect(aliceNotes.map((n) => n.title)).toEqual(['Old note']);
    expect((await alice.agent.get('/api/collections')).body.map((c) => c.name)).toEqual(['Old collection']);

    // Bob's existing note was not reassigned.
    const bobNote = await Note.findById(owned._id).lean();
    expect(bobNote.owner.toString()).toBe(bob.user.id);
  });
});
