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
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

module.exports = mongoose.model('Note', noteSchema);
