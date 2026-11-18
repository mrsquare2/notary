# Testing

Run the tests and show the output. Do not just say "done".

## Commands

| What | Command |
|---|---|
| All backend tests | `npm test` (runs `node --test "test/*.test.js"` in `backend/`) |
| One file | `cd backend && node --test test/api.test.js` |
| Frontend builds cleanly | `npm run build` |
| Seed and start locally to try it | `npm run db:seed && npm run dev`, then open http://localhost:5180 |

Tests use an in-memory SQLite DB (`:memory:`) seeded from the JSON files, so they need no setup and never touch `backend/data/notary.db`. MySQL isn't covered by automated tests yet. Before release, run `db:seed` and a smoke test against a real MySQL. **Default chosen, please confirm.**

## What the suites cover today

- `test/bank.test.js`: all four state banks load and validate; ≥150 questions per state and ≥600 total; core topics populated; ≥15% each of easy, medium and hard; every option has a `why` starting "Correct."/"Wrong." of ≥25 characters; sources present; unique IDs and text; validator rejects bad data; SQLite seed → load round trip (and re-seed doesn't duplicate); shuffle and mock allocation.
- `test/api.test.js`: states listing; client ID required; practice filtering, hidden answer key, feedback with per-option explanations, answer locking; option shuffling; timed mock grading and pass/fail; per-browser privacy; bad-input rejection; rate limit returns 429 with `Retry-After`, while `/health` is not limited; security headers present and no CORS.
- `test/seo.test.js`: each state page gets its own title, canonical link, FAQ structured data and readable HTML; Texas copy never claims a state exam; private and unknown pages are `noindex` (unknown = 404); `robots.txt` and `sitemap.xml` use `SITE_URL` and list every state; HTML and JSON-LD are escaped.
- `test/store.test.js`: the global results cap drops the oldest results.

## What must have a test

- Any change to quiz logic, grading, timing, validation, rate limiting or database code: add or update a test in the same change.
- Anything touching who can see what (client ID checks, answer-key reveal, **planned** admin auth and lockout) needs a test proving the wrong person gets 401/403/404.
- New question data must pass `bank.test.js` unchanged. Don't loosen a test to make data pass.
- Bug fixes: first a failing test that reproduces the bug, then the fix.
- Pure UI layout changes need no unit test, but must build and be checked in a browser.

## What "done" means

1. `npm test` passes, and the output is shown.
2. `npm run build` succeeds if frontend files changed.
3. The feature was tried in the running app for user-facing changes, with what was checked described.
4. Docs in `docs/` are updated if behavior, data or rules changed, and they still agree with each other.
5. Anything skipped or unverified is said plainly.
