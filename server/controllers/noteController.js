const Note = require('../models/Note');

const calculateWordStats = (content) => {
  if (!content) return { wordCount: 0, readingTime: 0 };
  
  // Remove markdown symbols and extra whitespace
  const cleanContent = content
    .replace(/#\w+/g, '') // Remove hashtags
    .replace(/[*_~`#]/g, '') // Remove markdown symbols
    .trim();
  
  // Split into words and filter empty strings
  const words = cleanContent
    .split(/\s+/)
    .filter(word => word.length > 0);
  
  const wordCount = words.length;
  // Minimum 1 minute reading time
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  
  return { wordCount, readingTime };
};

const createNote = async (req, res) => {
  try {
    let { date, month, title, content, tags, sources } = req.body;

    // Validate required fields
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // If date is not provided, use current date
    if (!date) {
      const today = new Date();
      date = today.toISOString().split('T')[0];
      month = today.toLocaleString('default', { month: 'long' });
    }

    // Extract title from first line if not provided
    if (!title) {
      const firstLine = content.split('\n')[0];
      title = firstLine.replace(/^#+\s*/, '').slice(0, 100); // Remove markdown headers and limit length
    }

    // Extract tags from content and merge with provided tags
    const contentTags = content
      .split('\n')
      .filter(line => line.includes('#'))
      .map(line => line.match(/#(\w+)/g))
      .flat()
      .map(tag => tag.slice(1)); // Remove # symbol

    const providedTags = Array.isArray(tags) ? tags : [];
    const uniqueTags = [...new Set([...providedTags, ...contentTags])];

    // Calculate word stats
    const stats = calculateWordStats(content);

    // Create the note with sources
    const note = await Note.create({
      date,
      month,
      title,
      content,
      tags: uniqueTags,
      sources: sources || [], // Add sources array
      wordCount: stats.wordCount,
      readingTime: stats.readingTime,
      mediaFiles: [],
      pinned: false
    });

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      data: note
    });

  } catch (err) {
    console.error('Error creating note:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create note',
      error: err.message
    });
  }
};

const getNotesByMonth = async (req, res) => {
  const { month } = req.params;
  try {
    const notes = await Note.find({ month }).sort({ pinned: -1, date: -1 });
    res.status(200).json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getNoteByDate = async (req, res) => {
  const { date } = req.params;
  try {
    const note = await Note.findOne({ date });
    if (note) res.status(200).json(note);
    else res.status(404).json({ message: 'Note not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const searchNotes = async (req, res) => {
  const { q } = req.query;
  try {
    const notes = await Note.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
      ],
    });
    res.status(200).json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateNote = async (req, res) => {
  const { id } = req.params;
  const { title, content, tags } = req.body;
  try {
    const { wordCount, readingTime } = calculateWordStats(content);
    const note = await Note.findByIdAndUpdate(
      id,
      { title, content, tags, wordCount, readingTime },
      { new: true }
    );
    res.status(200).json(note);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteNote = async (req, res) => {
  const { id } = req.params;
  try {
    await Note.findByIdAndDelete(id);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const pinNote = async (req, res) => {
  const { id } = req.params;
  try {
    const note = await Note.findById(id);
    note.pinned = !note.pinned;
    await note.save();
    res.status(200).json(note);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getNotesStats = async (req, res) => {
  try {
    // Get total notes per month
    const monthlyStats = await Note.aggregate([
      {
        $group: {
          _id: '$month',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get tag usage
    const tagStats = await Note.aggregate([
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get most active days
    const activeDays = await Note.aggregate([
      {
        $group: {
          _id: '$date',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      monthlyStats,
      tagStats,
      activeDays,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { id } = req.params;
    const note = await Note.findById(id);
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const mediaFile = {
      filename: req.file.originalname,
      path: req.file.path.replace(/\\/g, '/'), // Convert Windows path to URL format
      type: req.file.mimetype.split('/')[0], // 'image', 'application', etc.
      uploadDate: new Date()
    };

    note.mediaFiles.push(mediaFile);
    await note.save();

    res.status(200).json(mediaFile);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getAllNotes = async (req, res) => {
  try {
    const notes = await Note.find({})
      .sort({ pinned: -1, date: -1 }); // Sort by pinned first, then by date

    res.status(200).json({
      success: true,
      count: notes.length,
      data: notes
    });
  } catch (err) {
    console.error('Error fetching all notes:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notes',
      error: err.message
    });
  }
};

const getNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }
    
    res.status(200).json(note);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching note',
      error: err.message
    });
  }
};

module.exports = {
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
  getNote,
};