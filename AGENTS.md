# AGENTS.md

This is the front door. Read this file first. Then read the 7 files in `docs/` before you write any code.

## What this project is

NotaryPrepPro (working name; it will change) is a free web app that helps people study for the notary public exam in Texas, New York, California and Florida. Learners practice by topic, with an explanation for every answer option, or take a timed mock exam. The UI is Vue 3 + PrimeVue; the API is Node.js + Express. The question bank lives in SQLite locally and MySQL in production.

## Read these first, in this order

1. `docs/PRD.md`: what we are building, for whom, and what is out of scope
2. `docs/ARCHITECTURE.md`: stack, folders, how the parts connect
3. `docs/DATABASE.md`: tables, fields, who may read or change them
4. `docs/DESIGN-SYSTEM.md`: colors, type, components, words on screen
5. `docs/SECURITY.md`: who can see what, secrets, rate limits, pre-launch checks
6. `docs/CODE-STYLE.md`: house rules for code
7. `docs/TESTING.md`: commands, what needs a test, what "done" means

Items marked **Planned** in these files are agreed but not built yet. Items marked **UNKNOWN** or **Default chosen, please confirm** are open; ask the owner before relying on them.

## Commands

| What | Command (from the repo root) |
|---|---|
| Install | `npm install && npm run install:all` |
| Seed the local SQLite question bank | `npm run db:seed` |
| Run locally (API :4100, web :5180) | `npm run dev` |
| Run tests | `npm test` |
| Build the web app | `npm run build` |
| Start production (serves API + built app) | `npm start` (needs `NODE_ENV=production` and `DATABASE_URL=mysql://...`) |

## Rules

- Build one small piece at a time. Show me the plan first for anything that touches more than one file.
- Stay inside the PRD. If something is not in it, ask before adding it.
- Never put secrets in code or in these files. Use environment variables.
- Run the checks in `docs/TESTING.md` and show me the output. Do not just say "done".
- Ask before deleting files, adding paid services, or pushing anything live.
- If you are not sure, ask. A short question is cheaper than a wrong guess.
- If two files disagree, stop and ask me. Do not pick one quietly.
- Question content is legal information. Do not change a question's correct answer or legal facts without the owner's approval, and keep the `source` citation accurate.
- `sqlite3` runs an install script; it is approved in `backend/package.json` → `allowScripts`. Do not add other packages with install scripts without asking.

## Using Claude Code?

There is no `CLAUDE.md` in this repo, so Claude Code reads this file. If someone adds a `CLAUDE.md` later, put `@AGENTS.md` on its first line (ask the owner first).
