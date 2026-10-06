const { rateLimit } = require('express-rate-limit');
const { AppError } = require('../utils/AppError');

const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_FAILURES = 10;

// Limits password guessing: at most 10 failed logins per email address per
// 15 minutes (successful logins are not counted). It is keyed by the email,
// not the IP, because the API sits behind Vercel's proxy and Render's load
// balancer, so the client IP is not reliable. Trade-off: someone who knows an
// email can lock that account's logins for 15 minutes.
// The counter is in memory, which is fine for a single server instance.
const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MINUTES * 60 * 1000,
  limit: LOGIN_MAX_FAILURES,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Runs after validate(), so the email is already trimmed and lowercased.
  keyGenerator: (req) => `login:${req.valid.body.email}`,
  // The key does not use the IP, so proxy header checks are not needed.
  validate: { xForwardedForHeader: false },
  handler: (req, res, next) => {
    next(new AppError(
      429,
      'TOO_MANY_REQUESTS',
      `Too many failed login attempts. Try again in ${LOGIN_WINDOW_MINUTES} minutes.`
    ));
  }
});

module.exports = { loginLimiter, LOGIN_MAX_FAILURES };
