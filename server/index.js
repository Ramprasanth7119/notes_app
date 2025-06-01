const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dbconn = require('./config/db');
const noteRoutes = require('./routes/NoteRouter');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/notes', noteRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the Notes App!');
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});