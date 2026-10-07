import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Collection, copyAppData, createCollection, createNote, Note, planCopy, signUp, User } from './helpers.js';

// scripts/copyToDatabase.js: moves this app's data out of a database shared
// with another project. Source is the per-file test database; target is a
// second database on the same server.

let source;
let target;
let alice;

beforeEach(async () => {
  source = mongoose.connection;
  target = source.useDb(`${source.name}-copy`);

  alice = await signUp('alice@example.com');
  const note = await createNote(alice.agent, { title: 'Owned', content: 'about kubernetes' });
  const collection = await createCollection(alice.agent, { name: 'Box' });
  await alice.agent.post(`/api/collections/${collection._id}/notes`).send({ noteId: note._id });

  // Data that was not created through this app's API.
  await User.collection.insertOne({ email: 'other-app@example.com', password: 'other app field' });
  await Note.collection.insertOne({ title: 'Legacy', content: 'from before auth' });
});

afterEach(async () => {
  await target.dropDatabase();
});

const rawDocs = async (connection, model) =>
  connection.db.collection(model.collection.collectionName).find().sort({ _id: 1 }).toArray();

describe('copyAppData', () => {
  it('plans the copy without writing anything', async () => {
    expect(await planCopy(source)).toEqual({ users: 1, notes: 2, collections: 1, skippedUsers: 1 });
    expect(await target.db.listCollections().toArray()).toEqual([]);
  });

  it('copies this app\'s users, all notes and collections, keeping ids', async () => {
    expect(await copyAppData(source, target)).toEqual({ users: 1, notes: 2, collections: 1 });

    const users = await rawDocs(target, User);
    expect(users.map((u) => u.email)).toEqual(['alice@example.com']);
    expect(users[0]._id.toString()).toBe(alice.user.id);
    expect(typeof users[0].passwordHash).toBe('string');

    expect(await rawDocs(target, Note)).toEqual(await rawDocs(source, Note));
    expect(await rawDocs(target, Collection)).toEqual(await rawDocs(source, Collection));

    // The source is only read.
    expect(await User.countDocuments()).toBe(2);
  });

  it('creates the schema indexes in the target', async () => {
    await copyAppData(source, target);

    const noteIndexes = (await target.db.collection('notes').indexes()).map((index) => index.name);
    expect(noteIndexes).toEqual(expect.arrayContaining(['note_text_search', 'note_owner_browse', 'note_owner_tag_browse']));

    const emailIndex = (await target.db.collection('users').indexes()).find((index) => index.key.email);
    expect(emailIndex.unique).toBe(true);

    const hits = await target.db.collection('notes').find({ owner: new mongoose.Types.ObjectId(alice.user.id), $text: { $search: 'kubernetes' } }).toArray();
    expect(hits.map((n) => n.title)).toEqual(['Owned']);
  });

  it('refuses to copy into a database that already has data', async () => {
    await copyAppData(source, target);

    await expect(copyAppData(source, target)).rejects.toThrow(/already has documents in "users"/);
    expect(await target.db.collection('notes').countDocuments()).toBe(2);
  });

  it('refuses to copy a database onto itself', async () => {
    await expect(copyAppData(source, source)).rejects.toThrow(/same database/);
  });
});
