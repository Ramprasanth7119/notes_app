const { z, objectId } = require('./common');

const name = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');
const description = z.string().trim().max(1000, 'Description must be at most 1000 characters');

const createCollectionBody = z.object({
  name,
  description: description.optional()
});

const updateCollectionBody = z.object({
  name: name.optional(),
  description: description.optional()
});

const addNoteBody = z.object({
  noteId: objectId
});

module.exports = { createCollectionBody, updateCollectionBody, addNoteBody };
