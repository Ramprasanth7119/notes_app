const Collection = require('../models/Collection');
const Note = require('../models/Note');
const { notFound } = require('../utils/AppError');

// Every query is scoped with `owner: req.user.id` (set by requireAuth from the
// verified JWT). Another user's collection is reported as 404, not 403.
// Bodies are validated by validation/collections.js and read from req.valid.

// Populated notes are filtered by owner as well, so a foreign note id can
// never be expanded into another user's note content.
const ownNotes = (req) => ({ path: 'notes', match: { owner: req.user.id } });

const ownCollection = (req) => ({ _id: req.params.id, owner: req.user.id });

const getCollections = async (req, res) => {
  const collections = await Collection.find({ owner: req.user.id })
    .populate(ownNotes(req))
    .sort({ updatedAt: -1 });
  res.json(collections);
};

const createCollection = async (req, res) => {
  const { name, description } = req.valid.body;
  const collection = await Collection.create({ owner: req.user.id, name, description });
  res.status(201).json(collection);
};

const getCollection = async (req, res) => {
  const collection = await Collection.findOne(ownCollection(req)).populate(ownNotes(req));
  if (!collection) throw notFound('Collection');
  res.json(collection);
};

const updateCollection = async (req, res) => {
  const collection = await Collection.findOneAndUpdate(ownCollection(req), req.valid.body, {
    new: true,
    runValidators: true
  });
  if (!collection) throw notFound('Collection');
  res.json(collection);
};

// The notes in a deleted collection are kept.
const deleteCollection = async (req, res) => {
  const collection = await Collection.findOneAndDelete(ownCollection(req));
  if (!collection) throw notFound('Collection');
  res.status(204).send();
};

const addNoteToCollection = async (req, res) => {
  const { noteId } = req.valid.body;
  const collection = await Collection.findOne(ownCollection(req));
  if (!collection) throw notFound('Collection');

  // The note must belong to the same user, otherwise anyone could pull a
  // foreign note into their own collection.
  if (!(await Note.exists({ _id: noteId, owner: req.user.id }))) {
    throw notFound('Note');
  }

  collection.notes.addToSet(noteId);
  await collection.save();
  res.json(collection);
};

const removeNoteFromCollection = async (req, res) => {
  const collection = await Collection.findOneAndUpdate(
    ownCollection(req),
    { $pull: { notes: req.params.noteId } },
    { new: true }
  );
  if (!collection) throw notFound('Collection');
  res.json(collection);
};

module.exports = {
  getCollections,
  createCollection,
  getCollection,
  updateCollection,
  deleteCollection,
  addNoteToCollection,
  removeNoteFromCollection
};
