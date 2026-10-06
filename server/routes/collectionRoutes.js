const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Note = require('../models/Note');
const requireAuth = require('../middleware/requireAuth');
const rejectInvalidId = require('../middleware/rejectInvalidId');
const { isObjectId } = require('../utils/objectId');

// Every query is scoped with `owner: req.user.id` (set by requireAuth from the
// verified JWT). Another user's collection is reported as 404, not 403.

router.use(requireAuth);
router.param('id', rejectInvalidId('Collection'));
router.param('noteId', rejectInvalidId('Note'));

// Populated notes are filtered by owner as well, so a foreign note id can
// never be expanded into another user's note content.
const ownNotes = (req) => ({ path: 'notes', match: { owner: req.user.id } });

const notFound = (res) => res.status(404).json({ message: 'Collection not found' });

// Get all collections
router.get('/', async (req, res) => {
  const collections = await Collection.find({ owner: req.user.id })
    .populate(ownNotes(req))
    .sort({ updatedAt: -1 });
  res.json(collections);
});

// Create collection
router.post('/', async (req, res) => {
  if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
    return res.status(400).json({ message: 'Collection name is required' });
  }
  const collection = await Collection.create({
    owner: req.user.id,
    name: req.body.name,
    description: req.body.description
  });
  res.status(201).json(collection);
});

// Get one collection
router.get('/:id', async (req, res) => {
  const collection = await Collection.findOne({ _id: req.params.id, owner: req.user.id })
    .populate(ownNotes(req));
  if (!collection) return notFound(res);
  res.json(collection);
});

// Rename / re-describe a collection
router.put('/:id', async (req, res) => {
  const update = {};
  if (req.body.name !== undefined) update.name = req.body.name;
  if (req.body.description !== undefined) update.description = req.body.description;

  const collection = await Collection.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.id },
    update,
    { new: true, runValidators: true }
  );
  if (!collection) return notFound(res);
  res.json(collection);
});

// Delete a collection (the notes in it are kept)
router.delete('/:id', async (req, res) => {
  const collection = await Collection.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
  if (!collection) return notFound(res);
  res.status(204).send();
});

// Add note to collection
router.post('/:id/notes', async (req, res) => {
  const { noteId } = req.body;
  const collection = await Collection.findOne({ _id: req.params.id, owner: req.user.id });
  if (!collection) return notFound(res);

  // The note must belong to the same user, otherwise anyone could pull a
  // foreign note into their own collection.
  const noteExists = isObjectId(noteId) &&
    await Note.exists({ _id: noteId, owner: req.user.id });
  if (!noteExists) {
    return res.status(404).json({ message: 'Note not found' });
  }

  collection.notes.addToSet(noteId);
  await collection.save();
  res.json(collection);
});

// Remove note from collection
router.delete('/:id/notes/:noteId', async (req, res) => {
  const collection = await Collection.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.id },
    { $pull: { notes: req.params.noteId } },
    { new: true }
  );
  if (!collection) return notFound(res);
  res.json(collection);
});

module.exports = router;
