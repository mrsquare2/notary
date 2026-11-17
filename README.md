# Notary Exam Prep

A web app for notary public exam practice. It starts with **Texas**, which has 159 questions across 10 topic areas, and is built so other states plug in as data.

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
npm run dev          # API on :4100, web app on http://localhost:5180
```

Production: `npm run build`, then `npm start`. Express serves the built app and the API on port 4100 (set `PORT` to change it).

Tests: `npm test`. They check bank validity, the 150+ question minimum, shuffling, mock allocation, the API flow and per-browser result isolation.

## Layout

```
backend/
  data/states/<code>/state.json   state name, topics, mock-exam settings, disclaimer
  data/states/<code>/<topic>.json questions for that topic
  data/runtime/                   sessions.json + results.json (created at runtime, git-ignored)
  src/bank.js     loads and validates question banks (fails fast on bad data)
  src/quiz.js     random selection, shuffling, per-topic allocation, grading
  src/store.js    JSON-file persistence (atomic writes)
  src/app.js      REST API (+ serves frontend/dist in production)
frontend/src/
  views/          Home, PracticeSetup, MockSetup, Quiz, Result, History
  utils/pdf.js    jsPDF + autotable report (lazy-loaded)
```

## Question format

```json
{
  "id": "tx-fee-01",
  "topic": "fees",
  "question": "What is the maximum fee for ...?",
  "options": ["$10", "$6", "$5", "$25"],
  "answer": 0,
  "explanation": "Why the answer is right.",
  "source": "Tex. Gov't Code §406.024"
}
```

`answer` is the index of the correct option. Options are shuffled when served, so the order in the file doesn't matter. Avoid "all/none of the above" options; the validator rejects them because they break under shuffling.

## Adding a state (NY, CA, FL, ...)

1. Create `backend/data/states/ny/state.json` with `code`, `name`, `authority`, `mock` (`questions`, `minutes`, `passPercent`), `topics` and `disclaimer`.
2. Add one `<topic-id>.json` file per topic.
3. Restart the server. The state appears in the picker automatically, and the bank is validated on startup.

Suggested mock settings, based on the real exams (check them against current official sources):

| State | Real exam | Source material |
|---|---|---|
| New York | 40 questions, 1 hour, 70% | "Notary Public License Law" (Department of State) |
| California | 45 questions, 1 hour, 70% | Notary Public Handbook (Secretary of State) |
| Florida | No state exam; a 3-hour education course is required | Florida Notary Law (ch. 117 F.S.) and the Governor's Reference Manual |

## Notes

- Learners are anonymous. Each browser gets a random id, so history is per-browser. Add accounts if you need cross-device history.
- JSON storage suits a single server process. For several instances, move `store.js` to SQLite or MySQL; it is the only file that touches storage.
- The content is a study aid, not legal advice. Texas questions cite Gov't Code ch. 406, CPRC ch. 121 and 1 TAC ch. 87. Have a subject-matter expert review them against current Secretary of State publications before launch.
