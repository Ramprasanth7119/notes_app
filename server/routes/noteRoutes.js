const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const requireAuth = require('../middleware/requireAuth');
const loadOwnedNote = require('../middleware/loadOwnedNote');
const rejectInvalidId = require('../middleware/rejectInvalidId');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, config.uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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
router.param('id', rejectInvalidId('Note'));
router.param('fileId', rejectInvalidId('File'));

router.post('/', createNote);
router.get('/', getAllNotes);
router.get('/month/:month', getNotesByMonth);
router.get('/date/:date', getNoteByDate);
router.get('/search', searchNotes);
router.get('/stats', getNotesStats);
router.get('/:id', loadOwnedNote, getNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);
router.patch('/:id/pin', loadOwnedNote, pinNote);
// Ownership is checked before multer runs, so a request for someone else's
// note is rejected without writing anything to disk.
router.post('/:id/upload', loadOwnedNote, upload.single('media'), uploadMedia);
router.get('/:id/files/:fileId', loadOwnedNote, getFile);
router.delete('/:id/files/:fileId', loadOwnedNote, deleteFile);

module.exports = router;
