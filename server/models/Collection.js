const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
  {
    // Set from the verified JWT on create; never taken from the request body.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    notes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note'
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Collection', collectionSchema);
