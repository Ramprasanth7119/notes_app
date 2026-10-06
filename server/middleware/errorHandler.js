const multer = require('multer');
const { AppError } = require('../utils/AppError');
const { MAX_FILE_SIZE } = require('./upload');

// Maps known error types to a status/code/message that is safe to show.
const describe = (err) => {
  if (err instanceof AppError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }
  // express.json(): malformed JSON or a body over the size limit
  if (err.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'Request body is not valid JSON' };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return { status: 413, code: 'FILE_TOO_LARGE', message: `File must be at most ${MAX_FILE_SIZE / (1024 * 1024)} MB` };
    }
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Upload must be a single file in the "media" field' };
  }
  // Safety net: request data is validated with Zod before it reaches
  // Mongoose, so these indicate a gap in a schema rather than a server bug.
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Request validation failed' };
  }
  if (err.code === 11000) {
    return { status: 409, code: 'CONFLICT', message: 'Resource already exists' };
  }
  return null;
};

// 404 for any path that no route handled.
const notFoundRoute = (req, res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
};

// The single place that writes error responses. Express 5 forwards errors
// thrown (or rejected) in async handlers here automatically.
// Response shape: { success: false, error: { code, message, details? } }
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const known = describe(err);
  if (!known) {
    // Unexpected: log everything server-side, reveal nothing to the client.
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  }

  const { status, code, message, details } = known || {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong'
  };

  const error = { code, message };
  if (details) error.details = details;
  // A file response may already have set these (res.attachment) before the
  // file turned out to be missing; the error must still go out as JSON.
  res.removeHeader('Content-Disposition');
  res.type('application/json');
  res.status(status).json({ success: false, error });
};

module.exports = { errorHandler, notFoundRoute };
