// LOCAL DEVELOPMENT BENCHMARK for GET /api/notes/search.
//
//   npm run bench:search                       # 10,000 notes per user, 200 requests per scenario
//   NOTES=50000 REQUESTS=500 npm run bench:search
//
// Starts an in-memory MongoDB and the real Express app on a random port,
// seeds two users with the same number of random notes (fixed seed, so runs
// are comparable), then times real HTTP requests made with a logged-in
// cookie. Numbers depend on the machine and are not production figures.

const os = require('os');
const path = require('path');

process.env.JWT_SECRET ||= 'benchmark-only-secret-not-used-anywhere-else';
process.env.UPLOAD_DIR ||= path.join(os.tmpdir(), 'notes-app-bench-uploads');

const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');
const app = require('../app');
const Note = require('../models/Note');

const NOTES_PER_USER = Number(process.env.NOTES) || 10000;
const REQUESTS = Number(process.env.REQUESTS) || 200;
const PASSWORD = 'benchmark password';

// Small deterministic PRNG (mulberry32) so every run seeds the same data.
const random = (() => {
  let seed = 42;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

const WORDS = (
  'react node express mongo index query schema cookie token session cache docker kubernetes cluster ' +
  'deploy release sprint review design api route model test coverage bug fix refactor feature plan ' +
  'meeting notes idea budget travel recipe book chapter summary goal habit workout running coffee ' +
  'garden music movie project client invoice report draft outline research paper lecture exam study ' +
  'python java golang rust typescript javascript css html layout grid flexbox animation theme dark ' +
  'light mobile tablet desktop network server database backup security password login search filter ' +
  'page limit sort tag collection upload file image video audio weekly daily monthly quarter team'
).split(' ');
// Rare "topic" words: each note gets two of 2,000, so a topic word appears in
// about ten notes. Real searches are usually for words like these, not for
// words that appear in half of all notes.
const SYLLABLES = ['ka', 'lo', 'ri', 'ven', 'tor', 'mi', 'sa', 'dun', 'pe', 'qui', 'zor', 'nal', 'bex', 'tu', 'fy', 'gar'];
const TOPICS = [];
for (const a of SYLLABLES) for (const b of SYLLABLES) for (const c of SYLLABLES) TOPICS.push(a + b + c);
for (let i = TOPICS.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [TOPICS[i], TOPICS[j]] = [TOPICS[j], TOPICS[i]];
}
TOPICS.length = 2000;

const TAGS = ['work', 'personal', 'ideas', 'learning', 'devops', 'frontend', 'backend', 'reading', 'health', 'finance'];

const sentence = (min, max) => Array.from({ length: between(min, max) }, () => pick(WORDS)).join(' ');

const makeNotes = (owner) =>
  Array.from({ length: NOTES_PER_USER }, () => ({
    owner,
    title: sentence(3, 6),
    content: `${sentence(40, 120)} ${pick(TOPICS)} ${pick(TOPICS)}`,
    tags: [...new Set(Array.from({ length: between(1, 3) }, () => pick(TAGS)))],
    date: '2026-10-01',
    month: 'October'
  }));

const stats = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return { avg: avg.toFixed(1), p50: at(0.5).toFixed(1), p95: at(0.95).toFixed(1), max: sorted.at(-1).toFixed(1) };
};

async function main() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'bench' });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const register = async (email) => {
    const res = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD })
    });
    const { user } = await res.json();
    return { id: user.id, cookie: res.headers.get('set-cookie').split(';')[0] };
  };

  try {
    const alice = await register('alice@bench.local');
    const bob = await register('bob@bench.local');

    let seeded = Date.now();
    for (const owner of [alice.id, bob.id]) {
      const notes = makeNotes(owner);
      for (let i = 0; i < notes.length; i += 1000) {
        await Note.insertMany(notes.slice(i, i + 1000), { ordered: false });
      }
    }
    seeded = Date.now() - seeded;

    const get = async (query) => {
      const started = performance.now();
      const res = await fetch(`${base}/notes/search?${new URLSearchParams(query)}`, {
        headers: { Cookie: alice.cookie }
      });
      const body = await res.json();
      const elapsed = performance.now() - started;
      if (res.status !== 200) throw new Error(`search failed: ${res.status} ${JSON.stringify(body)}`);
      return { elapsed, body };
    };

    const scenarios = {
      'text: rare word': () => ({ q: pick(TOPICS) }),
      'text: rare word + tag': () => ({ q: pick(TOPICS), tag: pick(TAGS) }),
      'text: common word': () => ({ q: pick(WORDS) }),
      'tag only': () => ({ tag: pick(TAGS) }),
      'browse page 1-50 (no q)': () => ({ page: String(between(1, 50)) })
    };

    // Warm-up so connection setup and first-query caching are not measured.
    for (let i = 0; i < 20; i++) await get(scenarios['text: rare word']());

    const rows = [];
    for (const [name, makeQuery] of Object.entries(scenarios)) {
      const samples = [];
      let totalSum = 0;
      for (let i = 0; i < REQUESTS; i++) {
        const { elapsed, body } = await get(makeQuery());
        samples.push(elapsed);
        totalSum += body.total;
      }
      rows.push({ scenario: name, requests: REQUESTS, avgMatches: Math.round(totalSum / REQUESTS), ...stats(samples) });
    }

    // Database level: the $text index vs the old unindexed regex search, for
    // the same word and the same page of 10 results plus a total count.
    const owner = new mongoose.Types.ObjectId(alice.id);
    const time = async (filter, sort) => {
      const samples = [];
      for (let i = 0; i < 50; i++) {
        const started = performance.now();
        await Promise.all([Note.find(filter).sort(sort).limit(10).lean(), Note.countDocuments(filter)]);
        samples.push(performance.now() - started);
      }
      const plan = await Note.find(filter).sort(sort).limit(10).explain('executionStats');
      return { ...stats(samples), docsExamined: plan.executionStats.totalDocsExamined, keysExamined: plan.executionStats.totalKeysExamined };
    };
    const dbRows = [];
    for (const word of [TOPICS[0], 'kubernetes']) {
      const textFilter = { owner, $text: { $search: word } };
      const regex = { $regex: word, $options: 'i' };
      const regexFilter = { owner, $or: [{ title: regex }, { content: regex }] };
      const matches = await Note.countDocuments(textFilter);
      dbRows.push({ query: `$text "${word}" (indexed)`, matches, ...(await time(textFilter, { score: { $meta: 'textScore' } })) });
      dbRows.push({ query: `regex /${word}/i (old approach)`, matches, ...(await time(regexFilter, { updatedAt: -1 })) });
    }

    const { version } = await mongoose.connection.db.admin().serverInfo();
    console.log('\nLOCAL DEVELOPMENT BENCHMARK — GET /api/notes/search (not production performance)\n');
    console.log(`Machine:  ${os.cpus()[0].model.trim()}, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM, ${os.platform()} ${os.release()}`);
    console.log(`Runtime:  Node ${process.version}, MongoDB ${version} (mongodb-memory-server, same machine)`);
    console.log(`Dataset:  ${NOTES_PER_USER.toLocaleString()} notes for the searching user + ${NOTES_PER_USER.toLocaleString()} for a second user (seeded in ${seeded} ms)`);
    console.log(`Requests: ${REQUESTS} sequential HTTP requests per scenario, limit=10, authenticated cookie\n`);
    console.table(rows);
    console.log('\nDatabase only, 50 runs each: one page of 10 results + the total count, for a rare and a common word\n');
    console.table(dbRows);
    console.log('Times are milliseconds.');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
