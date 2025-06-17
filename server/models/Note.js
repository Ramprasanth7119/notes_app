const mongoose = require('mongoose');

const mediaFileSchema = new mongoose.Schema({
  filename: String,
  path: String,
  type: String
});

mediaFileSchema.pre('save', function(next) {
  // Convert absolute paths to relative paths
  if (this.path && this.path.includes('uploads')) {
    this.path = this.path.split('uploads')[1];
  }
  next();
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