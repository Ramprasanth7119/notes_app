# Notes App — Verified Project Metrics

Every number here was measured on 2026-10-06 from this repository. Each section says how to reproduce it. Nothing here is a production measurement.

## Backend

Counted from the routers registered in Express (`routes/*.js`), not by hand.

| Metric | Count |
| --- | --- |
| REST endpoints | **24** |
| Authentication endpoints | 4 (`register`, `login`, `logout`, `me`) |
| Notes endpoints | 13 (includes 1 search endpoint and 2 attachment-file endpoints) |
| Collection endpoints | 7 |
| Search endpoints | 1 (`GET /api/notes/search`) |

Before this work the API had 17 routes (13 notes, 4 collections).
- 1 was replaced: the broken public `GET /api/notes/files/:filename` became the owner-checked `GET /api/notes/:id/files/:fileId`.
- The existing regex `/search` route was rewritten as the paginated text-search endpoint.
- New routes: 4 auth routes plus `GET`, `PUT` and `DELETE /api/collections/:id` (the client already called `DELETE`, which did not exist).

## Testing

`cd server && npm run test:coverage`

| Metric | Value |
| --- | --- |
| Test cases | **177** (124 `it` blocks; table-driven `it.each` cases are counted individually) |
| Passing | 177 |
| Failing | 0 |
| Test files (suites) | 10 |
| Line coverage | 86.53% (514 / 594 lines) |
| Statement coverage | 86.56% |
| Branch coverage | 75.42% |
| Function coverage | 90% |

- **What coverage measures:** `app.js`, `config`, `controllers`, `middleware`, `models`, `routes`, `utils`, `validation` and the two migration scripts. The benchmark script is excluded.
- **What's uncovered:** mostly `config/db.js` (only used by `index.js`), production-only config branches, and the migration scripts' command-line wrappers (their core functions are tested, and the wrappers were run by hand against a local MongoDB). Adding `copyToDatabase.js` lowered line coverage from 91.15% to 86.53% for that reason.
- **Database:** tests run against a real MongoDB 8.2.6 started by mongodb-memory-server. Nothing is mocked except one test that forces a database error to check the 500 response.

**Browser QA (local, not part of the committed suite):**
- A Playwright script drove the production build (`vite preview`) against the real API, with **61 checks**, all passing.
- It covered register, login, create, edit, delete, pin, search, tag, collection, pagination, upload, hashtags, dark mode, logout, and two-user isolation.
- It also checked for horizontal overflow at 375, 768 and 1280 px.

## Search Benchmark

**LOCAL DEVELOPMENT BENCHMARK — not production performance.** Reproduce with `cd server && npm run bench:search`.

- **Machine:** Intel Core i7-1165G7, 16 GB RAM, Windows 10. Node v24.15.0, MongoDB 8.2.6 (in-memory, same machine).
- **Dataset:** 10,000 notes for the searching user plus 10,000 for a second user. Random words with a fixed seed.
  - Each note also contains 2 of 2,000 rare "topic" words, so each topic word appears in about 10 notes.
  - The 280 common words each appear in about 56% of notes.
- **Requests:** 200 sequential authenticated HTTP requests per scenario, `limit=10`.

| Scenario | Avg matches | Average | p50 | p95 |
| --- | --- | --- | --- | --- |
| Text search, rare word | 10 | 4.7 ms | 4.5 ms | 6.0 ms |
| Text search, rare word + tag | 2 | 4.1 ms | 4.0 ms | 5.1 ms |
| Text search, common word | 5,643 | 62.2 ms | 75.7 ms | 81.7 ms |
| Tag filter only | 1,868 | 4.0 ms | 3.8 ms | 5.2 ms |
| Browse pages 1–50 (no query) | 10,000 | 5.4 ms | 5.1 ms | 6.5 ms |

**Database only** (one page of 10 results + total count, 50 runs each):

| Query | Matches | Average | Documents examined |
| --- | --- | --- | --- |
| `$text`, rare word (indexed) | 12 | 1.8 ms | 12 |
| Regex, rare word (previous implementation) | 12 | 68.0 ms | 10,000 |
| `$text`, common word (indexed) | 5,647 | 33.5 ms | 5,647 |
| Regex, common word (previous implementation) | 5,647 | 40.2 ms | 10,000 |

**What this shows:**
- The text index wins clearly when the search term is selective, which is the usual case.
- When a word appears in more than half of all notes, `$text` still has to score every match, so it's only slightly faster than scanning.
- **Index fix found by this benchmark:** tag-only and browse requests first averaged 81.8 ms and 83.1 ms, because MongoDB loaded and sorted all 10,000 notes in memory. After adding compound indexes `{ owner, pinned, updatedAt, _id }` and `{ owner, tags, pinned, updatedAt, _id }`, they average 4.0 ms and 5.4 ms. `search.test.js` checks that those query plans use the indexes without an in-memory sort.

## Frontend

Measured with `cd client && npm run build` (Vite 6).

| Metric | Before | After |
| --- | --- | --- |
| Initial JavaScript | 1,829 kB (616 kB gzip), one bundle | 325 kB (107 kB gzip) |
| Code split on demand | none | markdown editor 1,109 kB (374 kB gzip), charts 166 kB (57 kB gzip) |
| ESLint | 21 errors | 0 errors, 0 warnings |
| Direct dependencies | 18 | 9 |

## Security

| Item | Status |
| --- | --- |
| Authentication | Implemented (register, login, logout, session check) |
| Password hashing | bcrypt, cost 12 |
| Session mechanism | JWT (HS256, 7 days) in an httpOnly, SameSite=Lax cookie, Secure in production |
| Ownership isolation | Implemented for notes, collections and attachments; foreign resources return 404 |
| Request validation | Zod, on every body, query and path parameter |
| Error format | One shape for all errors; no stack traces or internal messages sent to clients |
| Login brute force | 10 failed attempts per email per 15 minutes |
| Upload rules | 5 MB, one file, extension + MIME allowlist, owner-checked download |
| Dependency audit | `npm audit --omit=dev`: 0 known vulnerabilities (server and client), checked 2026-10-06 |
