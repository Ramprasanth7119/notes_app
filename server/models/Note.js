const mongoose = require('mongoose');

const mediaFileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  path: { type: String, required: true },
  type: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now }
});

const noteSchema = new mongoose.Schema({
  date: { type: String, required: true },
  month: { type: String, required: true },
  title: { type: String, required: true },
  tags: { type: [String], default: [] },
  content: { type: String, required: true },
  pinned: { type: Boolean, default: false },
  wordCount: { type: Number, default: 0 },
  readingTime: { type: Number, default: 1 },
  mediaFiles: [mediaFileSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add pre-save middleware to update the updatedAt timestamp
noteSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Note', noteSchema);