const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const config = require('./config/env');
const { errorHandler, notFoundRoute } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const collectionRoutes = require('./routes/collectionRoutes');

// Create uploads directory if it doesn't exist
fs.mkdirSync(config.uploadDir, { recursive: true });

const app = express();

// Cookies are only sent cross-origin when the origin is allow-listed and
// credentials are enabled; a wildcard origin is not allowed with credentials.
app.use(cors({ origin: config.clientOrigins, credentials: true }));
// Notes are text (content is capped at 100k characters by validation) and
// files go through multer, so JSON bodies never need to be large.
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/collections', collectionRoutes);

app.use(notFoundRoute);
app.use(errorHandler);

module.exports = app;
