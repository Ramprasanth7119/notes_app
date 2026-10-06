const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  title: String,
  url: String
});

const mediaFileSchema = new mongoose.Schema({
  filename: String,
  path: String,
  type: String
});

const noteSchema = new mongoose.Schema(
  {
    // Set from the verified JWT on create; never taken from the request body.
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    month: { type: String, required: true },
    title: { type: String, required: true },
    tags: { type: [String], default: [] },
    content: { type: String, required: true },
    pinned: { type: Boolean, default: false },
    wordCount: { type: Number, default: 0 },
    readingTime: { type: Number, default: 1 },
    mediaFiles: [mediaFileSchema],
    sources: [sourceSchema]
  },
  // Keeps the existing createdAt/updatedAt fields, and unlike the previous
  // pre('save') hook also bumps updatedAt on findOneAndUpdate.
  { timestamps: true }
);

// Full-text search over title and content (GET /api/notes/search).
// `owner` is an equality prefix, so MongoDB requires every $text query on this
// index to also match one owner: user scoping is enforced by the index itself,
// and each search only scans that user's index entries. A collection can have
// only one text index. Title matches rank higher than content matches.
noteSchema.index(
  { owner: 1, title: 'text', content: 'text' },
  { name: 'note_text_search', weights: { title: 5, content: 1 } }
);

// Listing and browsing: one user's notes, pinned first, newest first. With
// this index MongoDB reads only the 10 entries of the requested page instead
// of loading and sorting all of the user's notes (found with
// scripts/benchmarkSearch.js). Its owner prefix also serves every other
// "notes of this user" query.
noteSchema.index({ owner: 1, pinned: -1, updatedAt: -1, _id: -1 }, { name: 'note_owner_browse' });

// Same, filtered by tag (the tag chips in the UI).
noteSchema.index({ owner: 1, tags: 1, pinned: -1, updatedAt: -1, _id: -1 }, { name: 'note_owner_tag_browse' });

module.exports = mongoose.model('Note', noteSchema);
