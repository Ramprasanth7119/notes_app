# Interview Notes — Notes App

Plain-language explanations of how this project works, with the file to point at for each topic. Every answer describes what the code actually does.

---

### 1. How authentication works

1. **Register** (`POST /api/auth/register`):
   - Zod checks the email and password.
   - The password is hashed with bcrypt.
   - MongoDB stores `{ email, passwordHash }`.
2. **Login** (`POST /api/auth/login`):
   - Find the user by email, then `bcrypt.compare` the password with the stored hash.
   - If it matches, the server signs a JWT whose payload is just `{ sub: userId }` (HS256, expires in 7 days) and sends it as a cookie.
3. **Every later request:**
   - The browser sends the cookie automatically.
   - The `requireAuth` middleware verifies the signature and expiry, checks the user still exists, and sets `req.user`.
   - If anything is wrong, it returns 401.
4. **Logout** clears the cookie.
5. **The React app** doesn't read the token at all. It calls `GET /api/auth/me` on load to find out who is signed in.

Files: `server/controllers/authController.js`, `server/middleware/requireAuth.js`, `server/utils/authCookie.js`, `client/src/contexts/AuthProvider.jsx`.

### 2. Why bcrypt is used

- **Slow on purpose:** bcrypt is deliberately slow (cost 12, so 2¹² rounds) and salts every hash. If the database leaked, an attacker would need a lot of work per guess, and two users with the same password get different hashes.
- **Hashing, not encryption:** I store a hash, never something that can be decrypted.
- **The 72-byte detail:** bcrypt ignores everything after 72 bytes, so passwords longer than that are rejected instead of being silently cut off.
- **Login doesn't reveal which emails exist:** for an unknown email, login still runs a comparison against a dummy hash, so the response time is about the same as for a wrong password.

### 3. Why the JWT is stored in an httpOnly cookie

- **Protection against XSS:** with `localStorage`, any injected script could read the token and send it somewhere. An `httpOnly` cookie can't be read by JavaScript at all; the browser attaches it to requests by itself.
- **Cookie flags:**
  - `SameSite=Lax` stops other sites from making state-changing requests with the cookie (CSRF protection).
  - `Secure` (in production) means it's only sent over HTTPS.
  - The cookie lifetime matches the token's expiry.
- **The cross-domain problem:** the frontend (vercel.app) and the API (onrender.com) are different sites, and some browsers block third-party cookies. So the frontend calls `/api` on its own domain and Vercel forwards those requests to Render (`client/vercel.json`). To the browser everything is one site, and the cookie is first-party.

### 4. How user ownership is enforced

- Notes and collections have an `owner` field.
- **On create**, it's set from `req.user.id`, which comes from the verified token. Any `owner` sent by the client is stripped by Zod.
- **On read, update and delete**, the database query itself includes the owner: `Note.findOne({ _id: id, owner: req.user.id })`. Another user's note simply isn't found, so there's no separate "check after loading" that could be forgotten.
- **Collections** do the same, and when a collection's notes are expanded (`populate`), the notes are filtered by owner too.
- **Attachments** are served through `GET /api/notes/:id/files/:fileId`, which loads the note with the owner filter first. There's no public uploads folder.

Files: `server/middleware/loadOwnedNote.js`, `server/controllers/*`, `server/tests/ownership.test.js`.

### 5. Why unauthorized resources return 404

- If another user's note returned 403 Forbidden, an attacker would learn "this ID exists, it's just not yours".
- Returning 404 makes a foreign note look exactly like a note that doesn't exist, so nobody can probe which IDs are in use.
- A test checks that the two responses are identical.

### 6. How MongoDB text search works

- **Building the index:** a text index splits title and content into words, lowercases them, drops stop words ("the", "and"), and stems them ("deployments" → "deploy").
- **Querying:** a `$text` query looks up words in that index instead of scanning every note.
- **Ranking:** each match gets a relevance score. Title matches count 5× more than content matches, and results are sorted by that score.
- **My index:** `{ owner: 1, title: 'text', content: 'text' }`. Because `owner` comes first, MongoDB refuses any text query that doesn't specify one owner. So user isolation is also enforced by the database, and a search only scans that user's part of the index.
- **Limitation:** no prefix matching, so "kube" doesn't find "kubernetes". I documented this instead of hiding it; fixing it would need something like MongoDB Atlas Search.

### 7. Why search is server-side

- The old UI downloaded every note and filtered them in the browser. That gets slower as notes grow, sends data the user isn't looking at, and doesn't work with pagination.
- Now the browser sends `q`, `tag`, `collection` and `page` to `GET /api/notes/search`, and MongoDB returns only one page plus the total.
- **Measured result:** on 10,000 notes, a search for a specific word averages about 5 ms per request locally. The old regex approach examined all 10,000 notes at the database level (68 ms vs 1.8 ms).

### 8. How pagination works

- **Inputs:** `page` (1–10000) and `limit` (1–50, default 10). Anything else, like `1.5`, `-1`, `abc` or `limit=1000`, gets a 400.
- **Query:** the server runs `find(filter).sort(...).skip((page - 1) * limit).limit(limit)` and `countDocuments(filter)` at the same time.
- **Response:** `{ results, page, limit, total, totalPages }`. Asking for a page past the end returns an empty list with the real total, not an error.
- **Stable order:** the sort always ends with `_id`, so two notes with the same timestamp can't swap places between pages.
- **Why the cap:** without the cap on `limit`, one request could pull a user's entire dataset.

### 9. Why Zod is used

- **One schema per input:** request body, query string and path parameters each have a schema (`server/validation/`).
- **Validation runs first:** a `validate()` middleware runs the schema before the route handler. If it fails, the handler never runs and nothing touches the database.
- **Clean values for handlers:** on success, handlers read cleaned values (trimmed, defaulted, unknown fields removed) from `req.valid`.
- **What it prevents:**
  - **Mass assignment:** a client can't send `owner` or `mediaFiles`.
  - **Query operator injection:** `{"noteId": {"$ne": null}}` is rejected because it isn't a string ID.
- **Readable errors:** each problem is reported per field, e.g. `{ field: "body.email", message: "Email address is not valid" }`.

### 10. How centralized error handling works

- **Throwing errors:** code throws errors instead of writing error responses itself, e.g. `throw notFound('Note')` or `throw new AppError(409, 'CONFLICT', ...)`.
- **Express 5:** it automatically passes errors from `async` handlers to the error middleware, so no try/catch is needed in every route.
- **The one handler** (`server/middleware/errorHandler.js`) maps known errors to a status and code:
  - our `AppError`s
  - malformed JSON and oversized bodies
  - Multer upload errors
  - Mongoose validation errors
- **The format:** it always sends `{ success: false, error: { code, message, details? } }`.
- **Unexpected errors** are logged on the server with full detail. The client only gets "Something went wrong", with no stack trace or database message. A test feeds in an error containing a password and confirms it never reaches the response.

### 11. How the test architecture works

- **Real app, real HTTP:** tests use Supertest to send real requests to the real Express app, `server/app.js`. It's separate from `index.js`, so tests don't need to open a port.
- **Logged-in users:** a helper registers a user and returns a Supertest "agent" that keeps the cookie, like a logged-in browser. Most tests use two such users, Alice and Bob.
- **What each test checks:** the status code, the response body, and what actually changed in MongoDB or on disk.
  - Example: when Bob tries to update Alice's note, the test checks for a 404 *and* that the note in the database is unchanged.
- **The suite:** 177 tests in 10 files, covering auth, ownership, CRUD, search, validation, errors, attachments, hashtags, security and the database-move migration. 87% line coverage. GitHub Actions runs it on pushes to `main` and feature branches and on pull requests.
- **Checking the tests themselves:** I deliberately broke the ownership filter and the search filters to confirm the tests fail when they should.

### 12. Why mongodb-memory-server is useful

- **A real database:** it downloads and starts a real MongoDB binary, kept in memory for the test run. Tests exercise real queries, real indexes (unique email, text index), and real query plans.
- **Nothing to set up:** no developer needs MongoDB installed, CI doesn't need a database service, and tests can't damage real data.
- **Isolation:** each test file gets its own database, and collections are cleared after every test, so tests don't affect each other.
- **Same tool for the benchmark:** `npm run bench:search` uses it too.

### 13. How file uploads work with Multer

- **Order matters:** the upload route runs `requireAuth` → `loadOwnedNote` → `multer` → handler. Ownership is checked *before* Multer writes anything, so an upload to someone else's note never touches the disk.
- **Multer's checks:** it only accepts one file in the `media` field, up to 5 MB. The extension and the declared MIME type must both be on an allowlist (images, PDF, TXT, DOC, DOCX) and agree with each other.
- **Storage:** the file is saved under a random name like `1791299168094-106139381.png`, never the user's filename. The note records `{ filename, path, type }`.
- **Downloads:**
  - Files go through the owner-checked route with `X-Content-Type-Options: nosniff`.
  - Anything that isn't an image, PDF or text file is sent as a download, so an uploaded file can't run as a web page.
  - The stored path is reduced to a base name, which blocks `../` path traversal (tested).

### 14. How the React frontend communicates with the API

- **One axios instance** (`client/src/api/http.js`):
  - Base URL `/api` and `withCredentials: true`, so the cookie is sent.
  - An interceptor turns every error into an `ApiError` with `status`, `code`, `message` and field-level `details`. Forms use those details to show messages next to the right input.
  - If any request comes back as "unauthenticated", the app switches to logged-out and asks the user to log in again.
- **The notes page** keeps the search, tag, collection and page in the URL, so refresh and the back button work.
  - Typing is debounced (300 ms).
  - Each new search cancels the previous request with an `AbortController`, so a slow old response can't overwrite a newer one.
- **In development** Vite proxies `/api` to the Express server. **In production** Vercel rewrites `/api` to Render.

### 15. How the application behaves for multiple users

- **Users only ever see their own data:** every list, search, statistic and collection is filtered by the signed-in user.
- **Foreign URLs:** if Bob opens a link to Alice's note, collection or attachment, he gets "not found".
- **Two-user tests:**
  - The automated tests run Alice-and-Bob scenarios for every resource type.
  - A browser test registered two users, and the second could not open the first user's note, collection or file, or find their notes by search.
- **Old data from before accounts existed:**
  - It has no owner, so nobody sees it.
  - It isn't deleted. A migration script (`npm run migrate:assign-owner`) assigns it to one account, as a dry run unless `--apply` is passed.
- **A production bug after launch:**
  - Render logs showed a 500 on login: `bcrypt.compare` threw "data and hash arguments required".
  - The user record it found had no `passwordHash`, so this app never wrote it: the database was shared with another project that also has a `users` collection.
  - Fix: such a record is treated like an unknown email (401, same timing), with a test that writes one straight to MongoDB. A second script moves the app's data into its own `notes_app` database.

### 16. One technical challenge and how it was solved

**Browsing was slow, and a benchmark showed why.**

- **The setup:** I wrote a benchmark (`server/scripts/benchmarkSearch.js`) that seeds 10,000 notes per user and times real HTTP requests.
- **The finding:** text search for a specific word was fast, about 4 ms. But browsing pages and filtering by tag averaged about 82 ms.
- **The cause:** `explain()` showed those queries could only use the plain `owner` index, so MongoDB loaded all 10,000 of the user's notes and sorted them in memory just to return 10.
- **The fix:** compound indexes that match the query exactly: `{ owner, pinned, updatedAt, _id }` and `{ owner, tags, pinned, updatedAt, _id }`. Now MongoDB walks the index in sorted order and stops after the page.
- **The result:** browse dropped to about 5 ms and tag filtering to about 4 ms. I added a test that checks the query plan uses these indexes with no in-memory sort, so a future change can't silently undo it.

**Other bugs I found:**
- **Notes with headings crashed:** creating a note with a markdown heading (`# Title`) caused a 500, because the hashtag parser assumed every line containing `#` had a tag, and called `.slice()` on `null`.
- **Error JSON downloaded as a file:** when an attachment was missing from disk, the error response kept the file's download headers, so the browser would have saved the JSON as a file.
- **Upload limit off by one:** after a security update to Multer, my old workaround for its size limit would have allowed 5 MB + 1 byte.
- **Fixed with regression tests:** each of these was caught by a test and is now covered by one.
