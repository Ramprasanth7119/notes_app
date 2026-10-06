const { validationError } = require('../utils/AppError');

// Turns Zod issues into [{ field: 'body.email', message: '...' }].
const toDetails = (part, issues) =>
  issues.map((issue) => ({
    field: [part, ...issue.path].join('.'),
    message: issue.message
  }));

// validate({ body, query, params }) runs the given Zod schemas before the
// route handler. On success the parsed (trimmed, defaulted, stripped of
// unknown keys) values are put on req.valid; handlers read from there, not
// from req.body / req.query. On failure no handler code runs.
const validate = (schemas) => (req, res, next) => {
  const valid = {};
  const details = [];

  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) {
      valid[part] = result.data;
    } else {
      details.push(...toDetails(part, result.error.issues));
    }
  }

  if (details.length > 0) {
    return next(validationError(details));
  }
  req.valid = { ...req.valid, ...valid };
  next();
};

// For router.param(): validates one path segment with a Zod schema, so every
// route using :id gets the same check without repeating it.
const validateParam = (schema) => (req, res, next, value, name) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    return next(validationError(toDetails(`params.${name}`, result.error.issues)));
  }
  next();
};

module.exports = { validate, validateParam };
