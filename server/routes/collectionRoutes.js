const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');

// Get all collections
router.get('/', async (req, res) => {
  try {
    const collections = await Collection.find()
      .populate('notes')
      .sort({ updatedAt: -1 });
    res.json(collections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create collection
router.post('/', async (req, res) => {
  try {
    const collection = new Collection({
      name: req.body.name,
      description: req.body.description
    });
    const newCollection = await collection.save();
    res.status(201).json(newCollection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add note to collection
router.post('/:id/notes', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    
    const noteId = req.body.noteId;
    if (!collection.notes.includes(noteId)) {
      collection.notes.push(noteId);
      await collection.save();
    }
    
    res.json(collection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Remove note from collection
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    
    collection.notes = collection.notes.filter(
      note => note.toString() !== req.params.noteId
    );
    await collection.save();
    
    res.json(collection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;