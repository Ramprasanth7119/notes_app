const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Note = require('../models/Note');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images, PDFs, and common document formats
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const {
  createNote,
  getNotesByMonth,
  getNoteByDate,
  searchNotes,
  updateNote,
  deleteNote,
  pinNote,
  getNotesStats,
  uploadMedia,
  getAllNotes,
  getNote // Import the new controller function
} = require('../controllers/noteController');

router.post('/', createNote);
router.get('/month/:month', getNotesByMonth);
router.get('/date/:date', getNoteByDate);
router.get('/search', searchNotes);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);
router.patch('/:id/pin', pinNote);
router.get('/stats', async (req, res) => {
  try {
    // Monthly statistics
    const monthlyStats = await Note.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Tag statistics
    const tagStats = await Note.aggregate([
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Word count statistics
    const wordCountStats = await Note.aggregate([
      {
        $addFields: {
          wordCount: {
            $size: {
              $split: ["$content", " "]
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          avgWordCount: { $avg: "$wordCount" },
          maxWordCount: { $max: "$wordCount" },
          totalWords: { $sum: "$wordCount" }
        }
      }
    ]);

    res.json({
      monthlyStats,
      tagStats,
      wordCountStats: wordCountStats[0] || {
        avgWordCount: 0,
        maxWordCount: 0,
        totalWords: 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post('/:id/upload', upload.single('media'), uploadMedia);
router.get('/', getAllNotes);
router.get('/:id', getNote); // Add this route with your other routes
// Delete file from note
router.delete('/:noteId/files/:fileId', async (req, res) => {
  try {
    const { noteId, fileId } = req.params;
    const note = await Note.findById(noteId);

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Find the file in the mediaFiles array
    const fileIndex = note.mediaFiles.findIndex(
      file => file._id.toString() === fileId
    );

    if (fileIndex === -1) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Get file path and remove from filesystem
    const filePath = path.join(__dirname, '..', note.mediaFiles[fileIndex].path);
    await fs.unlink(filePath);

    // Remove file from note's mediaFiles array
    note.mediaFiles.splice(fileIndex, 1);
    await note.save();

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ message: 'Error deleting file' });
  }
});

module.exports = router;