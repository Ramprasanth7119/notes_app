// One-off migration for data created before authentication existed.
//
// Notes and collections created before this change have no `owner`, so no
// user can see them (every query filters by owner). This script assigns all
// such documents to one existing account. It never deletes anything.
//
//   node scripts/assignOwner.js --email you@example.com           # dry run
//   node scripts/assignOwner.js --email you@example.com --apply   # write
//
// Add --db <name> to use a different database than the one in MONGO_URI.

const mongoose = require('mongoose');
const Note = require('../models/Note');
const Collection = require('../models/Collection');

const ORPHANED = { owner: { $exists: false } };

const countOrphans = async () => ({
  notes: await Note.countDocuments(ORPHANED),
  collections: await Collection.countDocuments(ORPHANED)
});

const assignOrphansTo = async (userId) => {
  const owner = new mongoose.Types.ObjectId(userId);
  const notes = await Note.updateMany(ORPHANED, { $set: { owner } });
  const collections = await Collection.updateMany(ORPHANED, { $set: { owner } });
  return { notes: notes.modifiedCount, collections: collections.modifiedCount };
};

const main = async () => {
  require('dotenv').config();
  const User = require('../models/User');
  const connectDB = require('../config/db');

  const args = process.argv.slice(2);
  const emailIndex = args.indexOf('--email');
  const email = emailIndex !== -1 ? args[emailIndex + 1]?.toLowerCase() : undefined;
  const apply = args.includes('--apply');
  const dbIndex = args.indexOf('--db');
  const dbName = dbIndex !== -1 ? args[dbIndex + 1] : undefined;

  if (!email) {
    console.error('Usage: node scripts/assignOwner.js --email <registered email> [--db <name>] [--apply]');
    process.exitCode = 1;
    return;
  }

  await connectDB(process.env.MONGO_URI, dbName ? { dbName } : {});
  try {
    console.log(`Database: ${mongoose.connection.name}`);
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`No user with email ${email}. Register the account first.`);
      process.exitCode = 1;
      return;
    }

    const before = await countOrphans();
    console.log(`Documents without an owner: ${before.notes} notes, ${before.collections} collections`);

    if (!apply) {
      console.log('Dry run only. Re-run with --apply to assign them to', email);
      return;
    }

    const changed = await assignOrphansTo(user._id);
    console.log(`Assigned ${changed.notes} notes and ${changed.collections} collections to ${email}`);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { countOrphans, assignOrphansTo };
