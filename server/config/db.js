const mongoose = require("mongoose");

const dbconn = mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/notesapp")
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });

module.exports = dbconn;
