import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createNote, expectError, Note, signUp } from './helpers.js';

// File attachments: stored on disk by multer under a random name, recorded in
// note.mediaFiles, and served back only through the owner-checked route.

const diskPath = (file) => path.join(process.env.UPLOAD_DIR, path.basename(file.path));
// The 8-byte PNG signature is enough for an "image" upload.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let alice;
let note;

beforeEach(async () => {
  alice = await signUp('alice@example.com');
  note = await createNote(alice.agent);
});

const upload = (buffer, filename, contentType) =>
  alice.agent.post(`/api/notes/${note._id}/upload`).attach('media', buffer, { filename, contentType });

describe('upload', () => {
  it('stores the file on disk under a random name and records it on the note', async () => {
    const res = await upload(PNG_BYTES, 'holiday photo.png', 'image/png');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ filename: 'holiday photo.png', type: 'image' });
    expect(res.body.path).toMatch(/^\/\d+-\d+\.png$/); // client name never used on disk
    expect(fs.readFileSync(diskPath(res.body))).toEqual(PNG_BYTES);

    const stored = await Note.findById(note._id).lean();
    expect(stored.mediaFiles).toHaveLength(1);
    expect(stored.mediaFiles[0]._id.toString()).toBe(res.body._id);
  });

  it('keeps several attachments on one note', async () => {
    await upload(PNG_BYTES, 'a.png', 'image/png');
    await upload(Buffer.from('text'), 'b.txt', 'text/plain');

    const res = await alice.agent.get(`/api/notes/${note._id}`);
    expect(res.body.mediaFiles.map((f) => f.filename)).toEqual(['a.png', 'b.txt']);
  });
});

describe('download', () => {
  it('serves images inline with the right content type', async () => {
    const file = (await upload(PNG_BYTES, 'pic.png', 'image/png')).body;
    const res = await alice.agent.get(`/api/notes/${note._id}/files/${file._id}`).buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(res.body)).toEqual(PNG_BYTES);
  });

  it('sends Word documents as a download with the original filename', async () => {
    const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const file = (await upload(Buffer.from('PK fake docx'), 'report.docx', docxType)).body;

    const res = await alice.agent.get(`/api/notes/${note._id}/files/${file._id}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="report.docx"');
  });

  it('returns 404 when the record exists but the file is gone from disk', async () => {
    const file = (await upload(Buffer.from('x'), 'gone.txt', 'text/plain')).body;
    fs.unlinkSync(diskPath(file));

    const res = await alice.agent.get(`/api/notes/${note._id}/files/${file._id}`);
    expectError(res, 404, 'NOT_FOUND', 'File not found');
  });

  it('never follows a stored path outside the upload folder', async () => {
    // A legacy or tampered record pointing at the server's own package.json.
    await Note.updateOne(
      { _id: note._id },
      { $push: { mediaFiles: { filename: 'x', path: '/../../package.json', type: 'application' } } }
    );
    const fileId = (await Note.findById(note._id).lean()).mediaFiles[0]._id;

    const res = await alice.agent.get(`/api/notes/${note._id}/files/${fileId}`);
    expectError(res, 404, 'NOT_FOUND');
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(res.text).not.toMatch(/"dependencies"/);
  });

  it('returns 404 for a file id that is not on the note', async () => {
    const res = await alice.agent.get(`/api/notes/${note._id}/files/0123456789abcdef01234567`);
    expectError(res, 404, 'NOT_FOUND', 'File not found');
  });
});

describe('delete', () => {
  it('removes the file from disk and from the note', async () => {
    const file = (await upload(Buffer.from('bye'), 'bye.txt', 'text/plain')).body;
    expect(fs.existsSync(diskPath(file))).toBe(true);

    const res = await alice.agent.delete(`/api/notes/${note._id}/files/${file._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'File deleted successfully' });
    expect(fs.existsSync(diskPath(file))).toBe(false);
    expect((await Note.findById(note._id).lean()).mediaFiles).toEqual([]);

    expectError(await alice.agent.delete(`/api/notes/${note._id}/files/${file._id}`), 404, 'NOT_FOUND');
  });

  it('still removes the record when the file is already missing on disk', async () => {
    const file = (await upload(Buffer.from('x'), 'x.txt', 'text/plain')).body;
    fs.unlinkSync(diskPath(file));

    const res = await alice.agent.delete(`/api/notes/${note._id}/files/${file._id}`);

    expect(res.status).toBe(200);
    expect((await Note.findById(note._id).lean()).mediaFiles).toEqual([]);
  });
});
