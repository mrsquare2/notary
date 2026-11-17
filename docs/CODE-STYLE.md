# Code Style

The goal is code that reads as if one person wrote it. These rules describe what the codebase already does.

## General

- One file does one job. If it gets long (roughly 300+ lines) or does two things, split it.
- The smallest change that fully solves the task. No options, layers or abstractions "for later".
- Reuse what exists before adding anything: helpers in `frontend/src/utils`, the `api` wrapper, PrimeVue components, `HttpError`, `rateLimit`, the `db` interface.
- Don't add a dependency for a few lines of code. Ask before adding any dependency, and especially one with install scripts (it must go in `allowScripts`).
- Comments explain *why*, not *what*, in one line where possible. A deliberate shortcut gets `// shortcut: <limit>, <when to upgrade>`.

## JavaScript

- ES modules everywhere (`"type": "module"` in the backend); `import`/`export`, no CommonJS in app code.
- `camelCase` for variables and functions, `PascalCase` for classes and Vue components, `UPPER_SNAKE` for module constants (`PRACTICE_SIZES`, `DEFAULT_LIMITS`).
- 2-space indent, single quotes, semicolons, trailing commas in multi-line literals.
- Prefer `const`; small pure functions (see `quiz.js`); keep values in the form the platform gives you.
- Async I/O with `async`/`await`. Database access goes only through `db.all()` / `db.run()` with `?` placeholders.

## Errors

- API code throws `new HttpError(status, 'Plain message for the user.')`. The Express error handler turns it into `{ error }` JSON. 5xx responses hide details and log them server-side.
- Validate at the trust boundary (request bodies, headers, seed files) and fail fast with a clear message; `bank.js` refuses to load an invalid bank.
- Never swallow errors that could lose data. Rollback DB transactions on failure (see `seedStates`).
- Frontend shows errors in a PrimeVue `Toast` or `Message` using the server's message.

## Vue

- `<script setup>` single-file components; shared state in small composables in `stores/`.
- Views in `views/`, one per route; lazy-load every route except Home.
- Styling uses the tokens and utility classes from `docs/DESIGN-SYSTEM.md`; no inline colors.

## Question data

- One JSON file per topic, one question per line: `{"id","topic","difficulty","question","options":[{"text","why"}],"answer","explanation","source"}`.
- IDs are `<state>-<topic-abbr>-NN` and never reused. Keep `answer: 0` (options are shuffled when served).
- Each `why` starts with `Correct.` or `Wrong.` and gives the reason in at least 25 characters. Don't use "all/none of the above".
- Once the DB is the master (see `docs/DATABASE.md`), content edits go through the admin screen, and JSON is the export/backup format.

## Git

- Small commits with a message that says what changed and why. Never commit `.env`, `*.db`, `data/runtime/` or secrets.
