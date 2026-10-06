const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const Note = require('../models/Note');
const Collection = require('../models/Collection');
const config = require('../config/env');
const { extractHashtags } = require('../utils/hashtags');

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

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchNotes = async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    return res.status(200).json([]);
  }

  const pattern = { $regex: escapeRegex(q), $options: 'i' };
  const notes = await Note.find({
    owner: req.user.id,
    $or: [{ title: pattern }, { content: pattern }, { tags: pattern }]
  });
  res.status(200).json(notes);
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
