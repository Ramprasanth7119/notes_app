const { z } = require('zod');
const { isObjectId } = require('../utils/objectId');

const objectId = z.string().refine(isObjectId, 'Must be a valid id');

// "2026-10-06"; also rejects impossible dates such as 2026-13-45.
const isoDate = z
  .string()
  // abort: skip the calendar check when the format is already wrong
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Must be a date in YYYY-MM-DD format', abort: true })
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a real calendar date');

module.exports = { z, objectId, isoDate };
