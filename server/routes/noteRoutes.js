const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const loadOwnedNote = require('../middleware/loadOwnedNote');
const { upload } = require('../middleware/upload');
const { validate, validateParam } = require('../middleware/validate');
const { objectId } = require('../validation/common');
const { createNoteBody, updateNoteBody, searchQuery, monthParam, isoDate } = require('../validation/notes');

const {
  createNote,
  getAllNotes,
  getNote,
  getNotesByMonth,
  getNoteByDate,
  searchNotes,
  updateNote,
  deleteNote,
  pinNote,
  getNotesStats,
  uploadMedia,
  getFile,
  deleteFile
} = require('../controllers/noteController');

router.use(requireAuth);
// Path parameters are checked once here for every route that uses them.
router.param('id', validateParam(objectId));
router.param('fileId', validateParam(objectId));
router.param('month', validateParam(monthParam));
router.param('date', validateParam(isoDate));

router.post('/', validate({ body: createNoteBody }), createNote);
router.get('/', getAllNotes);
router.get('/month/:month', getNotesByMonth);
router.get('/date/:date', getNoteByDate);
router.get('/search', validate({ query: searchQuery }), searchNotes);
router.get('/stats', getNotesStats);
router.get('/:id', loadOwnedNote, getNote);
router.put('/:id', validate({ body: updateNoteBody }), loadOwnedNote, updateNote);
router.delete('/:id', deleteNote);
router.patch('/:id/pin', loadOwnedNote, pinNote);
// Ownership is checked before multer runs, so a request for someone else's
// note is rejected without writing anything to disk.
router.post('/:id/upload', loadOwnedNote, upload.single('media'), uploadMedia);
router.get('/:id/files/:fileId', loadOwnedNote, getFile);
router.delete('/:id/files/:fileId', loadOwnedNote, deleteFile);

module.exports = router;
