import { beforeEach, describe, expect, it } from 'vitest';
import { createNote, Note, signUp } from './helpers.js';

// Hashtag auto-tagging: every #word in a note's content becomes a tag, merged
// with the tags the client sent (see utils/hashtags.js).

let alice;

beforeEach(async () => {
  alice = await signUp('alice@example.com');
});

const tagsFor = async (content, tags) => {
  const note = await createNote(alice.agent, { content, ...(tags && { tags }) });
  return note.tags;
};

describe('on create', () => {
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

  it.each([
    ['markdown headings are not tags', '# Title\n## Section\n### Sub', []],
    ['a repeated hashtag is stored once', '#idea one, #idea two', ['idea']],
    ['letters, digits and underscores are part of a tag', '#year2026 #snake_case', ['year2026', 'snake_case']],
    ['punctuation ends a tag', 'Read #docs, then #ship.', ['docs', 'ship']],
    ['a lone # is ignored', 'C# and # alone', []],
    ['tags are case-sensitive', '#React #react', ['React', 'react']]
  ])('%s', async (_label, content, expected) => {
    expect(await tagsFor(content)).toEqual(expected);
  });

  it('does not count hashtags as words', async () => {
    const note = await createNote(alice.agent, { content: 'one two #three' });
    expect(note.wordCount).toBe(2);
    expect(note.readingTime).toBe(1);
  });
});

describe('on update', () => {
  it('adds hashtags from edited content and keeps existing tags', async () => {
    const note = await createNote(alice.agent, { content: 'first #draft' });

    const res = await alice.agent.put(`/api/notes/${note._id}`).send({ content: 'final version #published' });

    expect(res.status).toBe(200);
    // Tags are additive: removing "#draft" from the text does not remove the tag.
    expect(res.body.tags).toEqual(['draft', 'published']);
    expect((await Note.findById(note._id).lean()).tags).toEqual(['draft', 'published']);
  });

  it('replaces the tag list when tags are sent, then re-adds hashtags from new content', async () => {
    const note = await createNote(alice.agent, { content: 'text', tags: ['old'] });

    const res = await alice.agent.put(`/api/notes/${note._id}`).send({ tags: ['new'], content: 'see #ref' });

    expect(res.body.tags).toEqual(['new', 'ref']);
  });

  it('leaves tags alone when only the title changes', async () => {
    const note = await createNote(alice.agent, { content: 'text #kept' });

    const res = await alice.agent.put(`/api/notes/${note._id}`).send({ title: 'Renamed' });

    expect(res.body.tags).toEqual(['kept']);
  });
});
