# Architecture

## Stack (fixed; do not add a new library if the stack can already do the job)

| Layer | Choice |
|---|---|
| Web app | Vue 3, PrimeVue 4 (Aura preset, indigo primary), vue-router 5, Vite 8 |
| PDF export | jsPDF + jspdf-autotable, lazy-loaded in the browser |
| API | Node.js 20+ (developed on 26), Express 5, ES modules |
| Question bank DB | SQLite via `sqlite3` locally; MySQL via `mysql2` in production |
| Sessions & results | JSON files in `backend/data/runtime/` today. **Planned:** move to the same DB. |
| Tests | Node's built-in `node:test` |
| Hosting | Hostinger web/cloud hosting with Node.js + Hostinger MySQL. Node version support, process manager and whether a reverse proxy sits in front: **UNKNOWN: ask the owner / check the plan**. |

## Folders

```
AGENTS.md                 front door for coding agents
docs/                     these 7 project files
backend/
  data/states/<code>/     seed bank: state.json + one <topic>.json per topic
  data/notary.db          local SQLite file (git-ignored, created by db:seed)
  data/runtime/           sessions.json, results.json (git-ignored)
  src/db.js               one small interface over SQLite and MySQL: all(), run(), close()
  src/bank.js             validate, seed and load the question bank
  src/seed.js             CLI: copy JSON seed into the DB
  src/quiz.js             selection, shuffling, mock allocation, grading
  src/ratelimit.js        in-memory per-IP rate limiter
  src/store.js            JSON-file store for sessions/results
  src/app.js              Express routes (+ serves frontend/dist in production)
  src/server.js           startup: pick DB, load bank, listen
  test/                   node:test suites
frontend/src/
  views/                  Home, PracticeSetup, MockSetup, Quiz, Result, History
  stores/catalog.js       states list + selected state
  api.js                  fetch wrapper; adds the anonymous x-client-id header
  utils/                  pdf.js, format helpers, active-mock memory
```

## How the parts connect

1. `npm run db:seed` reads `backend/data/states/**` and validates it. It then writes the tables in `docs/DATABASE.md`, inside a transaction per state.
2. On startup `server.js` opens the DB named by `DATABASE_URL` (default: local SQLite file) and loads every state into memory. It then closes the DB connection, so the bank is read-only at runtime. **Planned:** admin edits reload the in-memory bank after saving.
3. The browser calls `/api/*` with an anonymous `x-client-id`. Sessions hold only question IDs and option order; the answer key stays on the server until a practice answer is locked or a mock is submitted.
4. In production, Express serves `frontend/dist` and the API on one port (`PORT`, default 4100). In development, Vite serves the UI on :5180 and proxies `/api` to :4100.

## Environment variables

| Name | Meaning |
|---|---|
| `NODE_ENV` | `production` forces MySQL; the server refuses to start without a `mysql://` `DATABASE_URL`. |
| `DATABASE_URL` | `mysql://user:pass@host:3306/db` in production; a SQLite path or nothing locally. |
| `PORT` | HTTP port (default 4100). |
| `DATA_DIR` | Folder for sessions/results JSON (default `backend/data/runtime`). |
| `TRUST_PROXY` | Set (e.g. `1`) behind a proxy so rate limits see the real client IP. Default for Hostinger: `1`. **Default chosen, please confirm.** |
| `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | **Planned** for the admin screen. Never commit values. |

## Known limits

- Rate-limit counters and the loaded bank live in one process. Running several processes multiplies limits and needs a shared store.
- The DB is master for questions once the admin screen ships (see `docs/DATABASE.md`). Today `db:seed`, and `npm run dev` through its `predev` hook, **overwrite** each seeded state; that must change before admin edits go live.
