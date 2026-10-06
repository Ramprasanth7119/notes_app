const jwt = require('jsonwebtoken');
const config = require('../config/env');

const AUTH_COOKIE = 'token';

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.cookieSameSite,
  path: '/'
});

const signToken = (userId) =>
  jwt.sign({ sub: userId.toString() }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessionDays}d`
  });

const verifyToken = (token) => jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });

const setAuthCookie = (res, userId) => {
  res.cookie(AUTH_COOKIE, signToken(userId), {
    ...cookieOptions(),
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
};

module.exports = { AUTH_COOKIE, setAuthCookie, clearAuthCookie, verifyToken };
