const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Note = require('../models/Note');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    cb(null, uploadPath);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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

    const file = note.mediaFiles.find(f => f._id.toString() === fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    const filePath = path.join(__dirname, '..', file.path);
    
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch (error) {
      console.log(`File ${filePath} already deleted or not found`);
    }

    // Remove file from note's mediaFiles array regardless of physical file status
    note.mediaFiles = note.mediaFiles.filter(f => f._id.toString() !== fileId);
    await note.save();

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ message: 'Error deleting file' });
  }
});
// Add this route for serving files
router.get('/files/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const uploadsDir = path.join(process.cwd(), 'uploads');
        const filePath = path.join(uploadsDir, filename);

        // Ensure uploads directory exists
        try {
            await fs.access(uploadsDir);
        } catch {
            await fs.mkdir(uploadsDir, { recursive: true });
        }

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            console.log(`File not found: ${filePath}`);
            return res.status(404).json({ message: 'File not found' });
        }

        // Get file stats
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            return res.status(404).json({ message: 'Not a file' });
        }

        // Set appropriate headers
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };

        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Use regular fs.createReadStream for streaming
        const fileStream = fs.createReadStream(filePath);
        
        // Handle stream errors
        fileStream.on('error', error => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error streaming file' });
            }
        });

        // Pipe the file to response
        fileStream.pipe(res);

    } catch (error) {
        console.error('File serving error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error' });
        }
    }
});

module.exports = router;