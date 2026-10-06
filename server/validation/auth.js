const { z } = require('./common');

const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password, so longer ones are
// rejected instead of being silently truncated.
const PASSWORD_MAX_BYTES = 72;

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Email address is not valid').max(254, 'Email address is too long'));

const registerBody = z.object({
  email,
  password: z
    .string({ error: 'Password is required' })
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES,
      `Password must be at most ${PASSWORD_MAX_BYTES} bytes`
    )
});

// Login only checks presence: format rules belong to registration, and a
// wrong-format email should get the same 401 as any other wrong email.
const loginBody = z.object({
  email: z.string({ error: 'Email is required' }).trim().toLowerCase().min(1, 'Email is required').max(254),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(1024)
});

module.exports = { registerBody, loginBody };
