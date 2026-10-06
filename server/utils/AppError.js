// An expected, client-facing error. The central error handler turns it into
//   { success: false, error: { code, message, details? } }
// Anything that is not an AppError is treated as an unexpected 500.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const notFound = (resource) => new AppError(404, 'NOT_FOUND', `${resource} not found`);

const validationError = (details) =>
  new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details);

module.exports = { AppError, notFound, validationError };
