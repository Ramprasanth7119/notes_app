const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const Note = require('../models/Note');
const Collection = require('../models/Collection');
const config = require('../config/env');
const { extractHashtags } = require('../utils/hashtags');
const { isObjectId } = require('../utils/objectId');

// Every query in this file includes `owner: req.user.id`. req.user is set by
// requireAuth from the verified JWT, so a client cannot read or change another
// user's notes by sending a different id or owner value.

const calculateWordStats = (content) => {
  if (!content) return { wordCount: 0, readingTime: 0 };

  // Remove markdown symbols and extra whitespace
  const cleanContent = content
    .replace(/#\w+/g, '') // Remove hashtags
    .replace(/[*_~`#]/g, '') // Remove markdown symbols
    .trim();

  // Split into words and filter empty strings
  const words = cleanContent
    .split(/\s+/)
    .filter(word => word.length > 0);

  const wordCount = words.length;
  // Minimum 1 minute reading time
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return { wordCount, readingTime };
};

// Uploaded files live on disk under a random name; the note stores "/<name>".
const resolveUploadPath = (file) => path.join(config.uploadDir, path.basename(file.path));

const removeUploadedFile = async (file) => {
  try {
    await fs.unlink(resolveUploadPath(file));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
};

const createNote = async (req, res) => {
  let { date, month, title, content, tags, sources } = req.body;

  // Validate required fields
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  // If date is not provided, use current date
  if (!date) {
    const today = new Date();
    date = today.toISOString().split('T')[0];
    month = today.toLocaleString('default', { month: 'long' });
  }

  // Extract title from first line if not provided
  if (!title) {
    const firstLine = content.split('\n')[0];
    title = firstLine.replace(/^#+\s*/, '').slice(0, 100); // Remove markdown headers and limit length
  }

  // Merge #hashtags found in the content with the tags sent by the client
  const providedTags = Array.isArray(tags) ? tags : [];
  const uniqueTags = [...new Set([...providedTags, ...extractHashtags(content)])];

  const stats = calculateWordStats(content);

  const note = await Note.create({
    owner: req.user.id,
    date,
    month,
    title,
    content,
    tags: uniqueTags,
    sources: sources || [],
    wordCount: stats.wordCount,
    readingTime: stats.readingTime,
    mediaFiles: [],
    pinned: false
  });

  res.status(201).json({
    success: true,
    message: 'Note created successfully',
    data: note
  });
};

const getAllNotes = async (req, res) => {
  const notes = await Note.find({ owner: req.user.id })
    .sort({ pinned: -1, date: -1 }); // Sort by pinned first, then by date

  res.status(200).json({
    success: true,
    count: notes.length,
    data: notes
  });
};

const getNote = (req, res) => {
  // Loaded and ownership-checked by loadOwnedNote
  res.status(200).json(req.note);
};

const getNotesByMonth = async (req, res) => {
  const notes = await Note.find({ owner: req.user.id, month: req.params.month })
    .sort({ pinned: -1, date: -1 });
  res.status(200).json(notes);
};

const getNoteByDate = async (req, res) => {
  const note = await Note.findOne({ owner: req.user.id, date: req.params.date });
  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }
  res.status(200).json(note);
};

const SEARCH_DEFAULT_LIMIT = 10;
const SEARCH_MAX_LIMIT = 50;
// Deep pages get slower with skip(); nobody pages this far through notes.
const SEARCH_MAX_PAGE = 10000;
const SEARCH_MAX_QUERY_LENGTH = 200;

// Returns the integer, the fallback when the param is absent, or null when
// the value is not a whole number in [1, max].
const parseBoundedInt = (raw, fallback, max) => {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 && value <= max ? value : null;
};

// GET /api/notes/search?q=&tag=&collection=&page=&limit=
// All filters are optional and combine with AND. Without q it lists the
// user's notes (pinned first, newest first), so the same endpoint serves
// "search" and "browse with filters".
const searchNotes = async (req, res) => {
  const { q = '', tag = '', collection = '' } = req.query;
  // ?q=a&q=b arrives as an array; only plain strings are accepted.
  if ([q, tag, collection].some((value) => typeof value !== 'string')) {
    return res.status(400).json({ message: 'q, tag and collection may each be given only once' });
  }

  const text = q.trim();
  if (text.length > SEARCH_MAX_QUERY_LENGTH) {
    return res.status(400).json({ message: `q must be at most ${SEARCH_MAX_QUERY_LENGTH} characters` });
  }
  const page = parseBoundedInt(req.query.page, 1, SEARCH_MAX_PAGE);
  if (page === null) {
    return res.status(400).json({ message: `page must be a whole number from 1 to ${SEARCH_MAX_PAGE}` });
  }
  const limit = parseBoundedInt(req.query.limit, SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT);
  if (limit === null) {
    return res.status(400).json({ message: `limit must be a whole number from 1 to ${SEARCH_MAX_LIMIT}` });
  }
  if (collection && !isObjectId(collection)) {
    return res.status(400).json({ message: 'collection must be a valid id' });
  }

  // owner comes first and is always present: a user can only ever search
  // their own notes, and the text index requires it (see models/Note.js).
  const filter = { owner: req.user.id };
  if (text) filter.$text = { $search: text };
  if (tag.trim()) filter.tags = tag.trim();
  if (collection) {
    // Filtering by someone else's collection is reported like a missing one.
    const found = await Collection.findOne({ _id: collection, owner: req.user.id }, 'notes').lean();
    if (!found) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    filter._id = { $in: found.notes };
  }

  // _id is the tie-breaker, so pages don't overlap when sort keys are equal.
  const sort = text
    ? { score: { $meta: 'textScore' }, _id: 1 }
    : { pinned: -1, updatedAt: -1, _id: -1 };

  const [results, total] = await Promise.all([
    Note.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Note.countDocuments(filter)
  ]);

  res.status(200).json({
    results,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });
};

const updateNote = async (req, res) => {
  // Only these fields can be changed by the client. owner, mediaFiles, etc.
  // in the body are ignored.
  const update = {};
  for (const field of ['title', 'content', 'tags']) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }
  if (update.content !== undefined) {
    Object.assign(update, calculateWordStats(update.content));
  }

  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.id },
    update,
    { new: true, runValidators: true }
  );
  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }
  res.status(200).json(note);
};

const deleteNote = async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }

  // Don't leave dangling references in collections or orphaned files on disk.
  await Collection.updateMany(
    { owner: req.user.id, notes: note._id },
    { $pull: { notes: note._id } }
  );
  await Promise.all(note.mediaFiles.map(removeUploadedFile));

  res.status(204).send();
};

const pinNote = async (req, res) => {
  req.note.pinned = !req.note.pinned;
  await req.note.save();
  res.status(200).json(req.note);
};

const getNotesStats = async (req, res) => {
  // aggregate() does not cast like find() does, so the id must be an ObjectId.
  const ownNotes = { $match: { owner: new mongoose.Types.ObjectId(req.user.id) } };

  // Monthly statistics
  const monthlyStats = await Note.aggregate([
    ownNotes,
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Tag statistics
  const tagStats = await Note.aggregate([
    ownNotes,
    { $unwind: "$tags" },
    {
      $group: {
        _id: "$tags",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Word count statistics
  const wordCountStats = await Note.aggregate([
    ownNotes,
    {
      $addFields: {
        wordCount: {
          $size: {
            $split: ["$content", " "]
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        avgWordCount: { $avg: "$wordCount" },
        maxWordCount: { $max: "$wordCount" },
        totalWords: { $sum: "$wordCount" }
      }
    }
  ]);

  res.json({
    monthlyStats,
    tagStats,
    wordCountStats: wordCountStats[0] || {
      avgWordCount: 0,
      maxWordCount: 0,
      totalWords: 0
    }
  });
};

const uploadMedia = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // req.note was ownership-checked by loadOwnedNote before multer stored the file
  req.note.mediaFiles.push({
    filename: req.file.originalname,
    path: `/${req.file.filename}`,
    type: req.file.mimetype.split('/')[0] // 'image', 'application', etc.
  });
  await req.note.save();

  res.status(200).json(req.note.mediaFiles[req.note.mediaFiles.length - 1]);
};

// Types the browser may render inline. Anything else (HTML, SVG, ...) is sent
// as a download so an uploaded file cannot run script on the API's origin.
const INLINE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt']);

const getFile = (req, res) => {
  const file = req.note.mediaFiles.id(req.params.fileId);
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }

  if (!INLINE_EXTENSIONS.has(path.extname(file.path).toLowerCase())) {
    res.attachment(file.filename);
  }
  res.set('X-Content-Type-Options', 'nosniff');

  res.sendFile(resolveUploadPath(file), (err) => {
    if (!err || res.headersSent) return;
    // The record exists but the file is gone from disk (e.g. host restarted
    // with an ephemeral filesystem).
    res.status(404).json({ message: 'File not found' });
  });
};

const deleteFile = async (req, res) => {
  const file = req.note.mediaFiles.id(req.params.fileId);
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }

  await removeUploadedFile(file);
  // Remove file from note's mediaFiles array regardless of physical file status
  file.deleteOne();
  await req.note.save();

  res.status(200).json({ message: 'File deleted successfully' });
};

module.exports = {
  createNote,
  getAllNotes,
  getNote,
  getNotesByMonth,
  getNoteByDate,
  searchNotes,
  updateNote,
  deleteNote,
  pinNote,
  getNotesStats,
  uploadMedia,
  getFile,
  deleteFile,
};
