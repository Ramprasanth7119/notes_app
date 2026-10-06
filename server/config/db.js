const mongoose = require('mongoose');

const connectDB = (uri) => {
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env and fill it in.');
  }
  return mongoose.connect(uri);
};

module.exports = connectDB;
