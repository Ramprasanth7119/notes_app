const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const config = require('./config/env');

const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const collectionRoutes = require('./routes/collectionRoutes');

// Create uploads directory if it doesn't exist
fs.mkdirSync(config.uploadDir, { recursive: true });

const app = express();

// Cookies are only sent cross-origin when the origin is allow-listed and
// credentials are enabled; a wildcard origin is not allowed with credentials.
app.use(cors({ origin: config.clientOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/collections', collectionRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  // Client errors: malformed JSON / oversized body (body-parser sets status)
  // and Mongoose schema or type-cast failures.
  const isMongooseInputError = err.name === 'ValidationError' || err.name === 'CastError';
  const status = err.status || err.statusCode || (isMongooseInputError ? 400 : 500);
  if (status < 500) {
    return res.status(status).json({ message: isMongooseInputError ? 'Invalid request data' : err.message });
  }

  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
