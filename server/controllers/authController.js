const bcrypt = require('bcrypt');
const User = require('../models/User');
const config = require('../config/env');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookie');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password, so longer ones are
// rejected instead of being silently truncated.
const PASSWORD_MAX_BYTES = 72;

// Compared against when the email is unknown, so a login attempt takes about
// the same time whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', config.bcryptRounds);

// The only user fields the API ever returns.
const toPublicUser = (user) => ({
  id: user._id.toString(),
  email: user.email,
  createdAt: user.createdAt
});

const readCredentials = (body) => ({
  email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '',
  password: typeof body?.password === 'string' ? body.password : ''
});

const register = async (req, res) => {
  const { email, password } = readCredentials(req.body);

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ message: 'Email address is not valid' });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return res.status(400).json({ message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes` });
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  let user;
  try {
    user = await User.create({ email, passwordHash });
  } catch (err) {
    // The unique index on email is the source of truth, which also covers two
    // registrations for the same email racing each other.
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    throw err;
  }

  setAuthCookie(res, user._id);
  res.status(201).json({ user: toPublicUser(user) });
};

const login = async (req, res) => {
  const { email, password } = readCredentials(req.body);

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
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
