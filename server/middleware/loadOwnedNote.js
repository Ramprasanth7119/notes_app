const Note = require('../models/Note');
const { notFound } = require('../utils/AppError');

// Loads the note named by :id only if it belongs to the signed-in user.
// Another user's note gets the same 404 as a note that does not exist, so the
// API never reveals whether an id is in use.
const loadOwnedNote = async (req, res, next) => {
  const note = await Note.findOne({ _id: req.params.id, owner: req.user.id });
  if (!note) {
    throw notFound('Note');
  }
  req.note = note;
  next();
};

module.exports = loadOwnedNote;
