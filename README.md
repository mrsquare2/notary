# Notary Exam Prep

A web app for notary public exam practice. It covers **Texas, New York, California and Florida**, with 150+ questions per state (627 in total) at easy, medium and hard difficulty. Every answer option explains why it is right or wrong. Agents and contributors: start with [AGENTS.md](AGENTS.md) and [docs/](docs/).

- **Topic-wise practice**: choose any of identification, acknowledgments, jurats/oaths, fees, recordkeeping, seal & certificates, commission, prohibited acts, special situations and online notarization. You get instant feedback with an explanation and legal citation for each question.
- **Timed mock exam**: 50 questions drawn in proportion to each topic, 60 minutes, 70% to pass. It has a question navigator, flag-for-review, keyboard shortcuts and auto-submit when time runs out. The timer is enforced by the server.
- **Randomized**: questions are drawn at random and answer options are shuffled on every test. The answer key stays on the server until the test is graded.
- **Results**: score, pass/fail, a breakdown by topic, a full answer review, **PDF export** (full report or summary only) and test history.

Stack: Vue 3 + PrimeVue 4 + Vite (frontend), Node.js + Express 5 (backend). Data is stored in JSON files.

## Run it

Requires Node 20+.

```bash
npm install          # root: installs concurrently
npm run install:all  # backend + frontend dependencies
npm run db:seed      # copy the JSON question bank into the local SQLite file (backend/data/notary.db)
npm run dev          # API on :4100, web app on http://localhost:5180 (seeds first)
```

Production: `npm run build`, then `npm start` with `NODE_ENV=production` and `DATABASE_URL=mysql://user:pass@host:3306/dbname` (run `npm run db:seed` once against that database). Express serves the built app and the API on port 4100 (set `PORT` to change it). Behind a reverse proxy, set `TRUST_PROXY=1` (a hop count) so rate limits see the real client IP, and set `SITE_URL=https://yourdomain.com` for canonical links and the sitemap.

The question bank lives in SQLite locally and MySQL in production; the JSON files under `backend/data/states/` are the seed. `sqlite3` builds a native module and is approved in `backend/package.json` → `allowScripts`.

Tests: `npm test`. They check bank validity, the 150+ per-state minimum, difficulty mix, per-option explanations, the SQLite seed/load round trip, shuffling, mock allocation, the API flow, per-browser result isolation and rate limiting.

## Layout

```
AGENTS.md                         start here if you're a coding agent
docs/                             PRD, architecture, database, design system, security, code style, testing
backend/
  data/states/<code>/state.json   state name, topics, mock-exam settings, notes, disclaimer
  data/states/<code>/<topic>.json questions for that topic (the seed for the database)
  data/notary.db                  local SQLite bank (created by db:seed, git-ignored)
  data/runtime/                   sessions.json + results.json (created at runtime, git-ignored)
  src/db.js        SQLite (local) / MySQL (production) behind one small interface
  src/bank.js      validates the seed, writes it to the DB, loads it back (fails fast on bad data)
  src/seed.js      npm run db:seed
  src/quiz.js      random selection, shuffling, per-topic allocation, grading
  src/ratelimit.js per-IP rate limiting
  src/store.js     JSON-file persistence (atomic writes, global results cap)
  src/seo.js       per-page titles, descriptions, FAQ structured data, robots.txt, sitemap.xml
  src/app.js       REST API, security headers, serves frontend/dist in production
  src/server.js    startup: env checks, load the bank, listen
  test/            node:test suites (bank, api, seo, store)
frontend/
  index.html       page shell; the server fills in each page's <head> and readable content
  public/fonts/    self-hosted Source Serif 4 + Public Sans, with their OFL licences
  public/media/    landing-page clips (.webm) and poster images, recorded from the real app
  src/brand.js     product name (one place) and page titles
  src/style.css    design tokens (light + dark) and shared styles
  src/components/  ReadinessRing
  src/views/       Home (landing + state pages), PracticeSetup, MockSetup, Quiz, Result, History
  src/utils/pdf.js jsPDF + autotable report (lazy-loaded)
```

## Question format

```json
{
  "id": "tx-fee-01",
  "topic": "fees",
  "difficulty": "easy",
  "question": "What is the maximum fee for ...?",
  "options": [
    { "text": "$10", "why": "Correct. §406.024 caps it at $10 for the first signature." },
    { "text": "$6", "why": "Wrong. $6 is an outdated figure; the current cap is $10." }
  ],
  "answer": 0,
  "explanation": "Why the answer is right.",
  "source": "Tex. Gov't Code §406.024"
}
```

`answer` is the index of the correct option. `difficulty` is `easy`, `medium` or `hard`. Each option's `why` must start with "Correct." or "Wrong." and give the reason. Options are shuffled when served, so the order in the file doesn't matter. Avoid "all/none of the above" options; the validator rejects them because they break under shuffling.

## Adding a state

1. Create `backend/data/states/<code>/state.json` with `code`, `name`, `authority`, `mock` (`questions`, `minutes`, `passPercent`), `topics`, `notes` and `disclaimer`.
2. Add one `<topic-id>.json` file per topic.
3. Run `npm run db:seed` and restart. The state appears in the picker automatically.

## Notes

- Learners are anonymous. Each browser gets a random id, so history is per-browser. Add accounts if you need cross-device history.
- Sessions and results are still JSON files (`store.js`). Moving them into MySQL is planned (see docs/DATABASE.md).
- The content is a study aid, not legal advice. Every question cites its statute or official handbook. Have a subject-matter expert review them against current Secretary of State publications before launch.
