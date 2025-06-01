const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    day: String,
    titles: [{
        title: String,
        content: String
    }]
});

module.exports = mongoose.model('Note', noteSchema);
