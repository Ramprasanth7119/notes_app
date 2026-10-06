const User = require('../models/User');
const { AUTH_COOKIE, verifyToken, clearAuthCookie } = require('../utils/authCookie');
const { isObjectId } = require('../utils/objectId');

// Reads the JWT from the httpOnly cookie, verifies it, and attaches the user
// to req.user. Every user-owned route sits behind this middleware, and the
// identity used for ownership checks comes only from here — never from the
// request body or query string.
const requireAuth = async (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({ message: 'Session is invalid or has expired' });
  }

  // The account may have been deleted after the token was issued.
  const user = isObjectId(payload.sub) ? await User.findById(payload.sub).lean() : null;
  if (!user) {
    clearAuthCookie(res);
    return res.status(401).json({ message: 'Session is invalid or has expired' });
  }

  req.user = { id: user._id.toString(), email: user.email, createdAt: user.createdAt };
  next();
};

module.exports = requireAuth;
