const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const noteRoutes = require('./routes/noteRoutes');
const collectionRoutes = require('./routes/collectionRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes 
app.use('/api/notes', noteRoutes);
app.use('/api/collections', collectionRoutes);

// Connect to DB and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(5000, () => {
      console.log('Server running on port 5000');
    });
  })
  .catch((err) => console.log(err));
