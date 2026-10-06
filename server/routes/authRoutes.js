const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { validate } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');
const { registerBody, loginBody } = require('../validation/auth');
const { register, login, logout, me } = require('../controllers/authController');

router.post('/register', validate({ body: registerBody }), register);
router.post('/login', validate({ body: loginBody }), loginLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
