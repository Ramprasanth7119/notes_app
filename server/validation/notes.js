const { z, objectId, isoDate } = require('./common');

const TITLE_MAX = 200;
const CONTENT_MAX = 100_000;
const TAG_MAX = 50;
const TAGS_MAX = 50;

const title = z.string().trim().max(TITLE_MAX, `Title must be at most ${TITLE_MAX} characters`);

// Content keeps its whitespace (it is markdown) but must not be blank.
const content = z
  .string({ error: 'Content is required' })
  .max(CONTENT_MAX, `Content must be at most ${CONTENT_MAX} characters`)
  .refine((value) => value.trim().length > 0, 'Content is required');

// The client sends tags split from a comma-separated input, which can
// contain blanks and duplicates; those are dropped rather than rejected.
const tags = z
  .array(z.string().trim().max(TAG_MAX, `Each tag must be at most ${TAG_MAX} characters`))
  .max(TAGS_MAX, `At most ${TAGS_MAX} tags`)
  .transform((list) => [...new Set(list.filter(Boolean))]);

// Only http(s) links: a stored "javascript:" URL would run when clicked.
const source = z.object({
  title: z.string().trim().min(1, 'Source title is required').max(200),
  url: z.url({ protocol: /^https?$/, error: 'Source URL must be an http(s) URL' }).max(2048)
});

const createNoteBody = z.object({
  title: title.optional(),
  content,
  tags: tags.optional(),
  date: isoDate.optional(),
  month: z.string().trim().min(1).max(20).optional(),
  sources: z.array(source).max(50).optional()
});

// Unknown keys (owner, _id, mediaFiles, ...) are stripped, which keeps the
// existing client that PUTs the whole note document working.
const updateNoteBody = z.object({
  title: title.min(1, 'Title cannot be empty').optional(),
  content: content.optional(),
  tags: tags.optional()
});

// Query strings arrive as text. Only plain digits are accepted, so values such
// as "1.5", "-1", "1e3" or "0x10" are rejected instead of being coerced.
const wholeNumber = (max) => {
  const message = `Must be a whole number from 1 to ${max}`;
  return z
    .string({ error: message })
    .regex(/^\d{1,6}$/, message)
    .transform(Number)
    .pipe(z.number().min(1, message).max(max, message));
};

const searchQuery = z.object({
  q: z.string({ error: 'Must be given once, as text' }).trim().max(200, 'Must be at most 200 characters').default(''),
  tag: z.string({ error: 'Must be given once, as text' }).trim().max(TAG_MAX).default(''),
  collection: z.union([z.literal(''), objectId]).default(''),
  page: wholeNumber(10000).default(1),
  // Capped so a client cannot pull a user's whole dataset in one request.
  limit: wholeNumber(50).default(10)
});

const monthParam = z.string().trim().min(1).max(20);

module.exports = { createNoteBody, updateNoteBody, searchQuery, monthParam, isoDate };
