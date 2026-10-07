// One-off move of this app's data into its own database.
//
// The production MONGO_URI had no database name, so the app shared MongoDB's
// default database with another project (including a `users` collection that
// project writes to). This script copies the app's data into a new database
// on the same cluster. It only reads from the source and never deletes.
//
//   node scripts/copyToDatabase.js --to notes_app           # dry run
//   node scripts/copyToDatabase.js --to notes_app --apply   # copy
//
// Then point MONGO_URI at the new database (".../notes_app?...") and redeploy.
// Anything written to the old database after the copy is not moved.

const mongoose = require('mongoose');
const User = require('../models/User');
const Note = require('../models/Note');
const Collection = require('../models/Collection');

const MODELS = [User, Note, Collection];
const BATCH_SIZE = 1000;

// Users created by this app always have a bcrypt hash. Any other document in
// `users` belongs to something else and is left behind.
const filterFor = (model) => (model === User ? { passwordHash: { $type: 'string' } } : {});

const planCopy = async (source) => {
  const plan = {};
  for (const model of MODELS) {
    plan[model.collection.collectionName] = await source.db
      .collection(model.collection.collectionName)
      .countDocuments(filterFor(model));
  }
  plan.skippedUsers =
    (await source.db.collection(User.collection.collectionName).countDocuments()) - plan.users;
  return plan;
};

const copyAppData = async (source, target) => {
  if (source.name === target.name) {
    throw new Error('Source and target are the same database');
  }

  for (const model of MODELS) {
    const name = model.collection.collectionName;
    if (await target.db.collection(name).countDocuments()) {
      throw new Error(`Target database "${target.name}" already has documents in "${name}"; nothing was copied`);
    }
  }

  // Build the schema indexes first (unique email, text search, browse indexes).
  for (const model of MODELS) {
    const targetModel = target.models[model.modelName] || target.model(model.modelName, model.schema);
    await targetModel.init();
  }

  const copied = {};
  for (const model of MODELS) {
    const name = model.collection.collectionName;
    const into = target.db.collection(name);
    let batch = [];
    copied[name] = 0;
    for await (const doc of source.db.collection(name).find(filterFor(model))) {
      batch.push(doc);
      if (batch.length === BATCH_SIZE) {
        await into.insertMany(batch);
        copied[name] += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await into.insertMany(batch);
      copied[name] += batch.length;
    }
  }
  return copied;
};

const main = async () => {
  require('dotenv').config();
  const connectDB = require('../config/db');

  const args = process.argv.slice(2);
  const toIndex = args.indexOf('--to');
  const targetName = toIndex !== -1 ? args[toIndex + 1] : undefined;
  const apply = args.includes('--apply');

  if (!targetName || !/^[\w-]{1,38}$/.test(targetName)) {
    console.error('Usage: node scripts/copyToDatabase.js --to <new database name> [--apply]');
    process.exitCode = 1;
    return;
  }

  await connectDB(process.env.MONGO_URI);
  try {
    const source = mongoose.connection;
    const target = source.useDb(targetName);
    const names = (await source.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();

    console.log(`Source database: ${source.name}`);
    console.log(`Collections in it: ${names.join(', ') || '(none)'}`);
    const plan = await planCopy(source);
    console.log(
      `Would copy to "${targetName}": ${plan.users} users, ${plan.notes} notes, ${plan.collections} collections` +
        ` (skipping ${plan.skippedUsers} users without a password hash)`
    );

    if (!apply) {
      console.log('Dry run only. Re-run with --apply to copy.');
      return;
    }

    const copied = await copyAppData(source, target);
    console.log(`Copied ${copied.users} users, ${copied.notes} notes, ${copied.collections} collections to "${targetName}"`);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { planCopy, copyAppData };
