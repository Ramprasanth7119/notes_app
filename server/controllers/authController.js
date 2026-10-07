const bcrypt = require('bcrypt');
const User = require('../models/User');
const config = require('../config/env');
const { AppError } = require('../utils/AppError');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookie');

// Request bodies are validated by validation/auth.js before these run.

// Compared against when the email is unknown, so a login attempt takes about
// the same time whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', config.bcryptRounds);

// The only user fields the API ever returns.
const toPublicUser = (user) => ({
  id: user._id.toString(),
  email: user.email,
  createdAt: user.createdAt
});

const register = async (req, res) => {
  const { email, password } = req.valid.body;
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  let user;
  try {
    user = await User.create({ email, passwordHash });
  } catch (err) {
    // The unique index on email is the source of truth, which also covers two
    // registrations for the same email racing each other.
    if (err.code === 11000) {
      throw new AppError(409, 'CONFLICT', 'An account with this email already exists');
    }
    throw err;
  }

  setAuthCookie(res, user._id);
  res.status(201).json({ user: toPublicUser(user) });
};

const login = async (req, res) => {
  const { email, password } = req.valid.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  // A user document without a hash was not written by this app (for example a
  // `users` collection shared with another app in the same database). Treat it
  // like an unknown email instead of letting bcrypt throw a 500.
  const hasHash = typeof user?.passwordHash === 'string';
  const passwordMatches = await bcrypt.compare(password, hasHash ? user.passwordHash : DUMMY_HASH);

  if (!hasHash || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  setAuthCookie(res, user._id);
  res.status(200).json({ user: toPublicUser(user) });
};

const logout = (req, res) => {
  clearAuthCookie(res);
  res.status(204).send();
};

const me = (req, res) => {
  res.status(200).json({ user: req.user });
};

module.exports = { register, login, logout, me };
