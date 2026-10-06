const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET is not set. Copy server/.env.example to server/.env and fill it in.');
}
if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('COOKIE_SAMESITE must be one of: lax, strict, none.');
}

const sessionDays = Number(process.env.SESSION_DAYS) || 7;

module.exports = {
  isProduction,
  jwtSecret,
  sessionDays,
  bcryptRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookieSameSite,
  // Browsers reject SameSite=None cookies that are not Secure.
  cookieSecure: isProduction || cookieSameSite === 'none',
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
};
