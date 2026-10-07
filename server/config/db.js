const mongoose = require('mongoose');

// `options.dbName` overrides the database named in the URI (used by scripts).
const connectDB = (uri, options = {}) => {
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env and fill it in.');
  }
  return mongoose.connect(uri, options);
};

module.exports = connectDB;
