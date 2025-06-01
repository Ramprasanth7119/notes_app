const express = require('express');
const router = express.Router();
const Note = require('../models/Note');

// Create a new Day
router.post('/day', async (req, res) => {
    const { day } = req.body;
    const newDay = new Note({ day, titles: [] });
    await newDay.save();
    res.json(newDay);
});

// Add title and note to a specific day
router.post('/day/:dayId/title', async (req, res) => {
    const { title, content } = req.body;
    const note = await Note.findById(req.params.dayId);
    note.titles.push({ title, content });
    await note.save();
    res.json(note);
});

// Get all days with notes
router.get('/', async (req, res) => {
    const notes = await Note.find();
    res.json(notes);
});

module.exports = router;
