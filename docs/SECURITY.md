# Security

## Who can see what (must match `docs/DATABASE.md`)

- **Learners are anonymous.** The browser stores a random `x-client-id` (8–64 chars, `[A-Za-z0-9-]`) and sends it on every API call. A learner can only see, answer, submit and delete their own sessions and results; anything else returns 404.
- The client ID is **not authentication**. Anyone who copies it can read that browser's history. That is acceptable only because no personal data is stored.
- **Answer key protection:** sessions store question IDs and option order only. Correct answers and per-option `why` notes are revealed only after a practice answer locks, or after a mock is submitted. Mock timers are enforced by the server (30-second grace).
- **Planned: admin.** One admin account. The password is stored only as a hash (bcrypt or argon2) in `ADMIN_PASSWORD_HASH`, never in plain text. Login sets an `HttpOnly`, `Secure`, `SameSite=Strict` session cookie signed with `SESSION_SECRET`. Lock login for 15 minutes after 5 failed attempts. Admin routes live under `/api/admin/*` and all require the session; the admin may see only aggregate usage, never individual learners' answers. All admin changes are written to `admin_audit`. **Default chosen, please confirm** (lockout numbers, hash algorithm).

## Secrets

- Secrets live only in environment variables on the host (Hostinger panel): `DATABASE_URL`, and later `ADMIN_PASSWORD_HASH` and `SESSION_SECRET`.
- Never put secrets in code, these docs, git, logs or error messages. `.env` is git-ignored.
- Use a MySQL user with access to this app's database only. **Default chosen, please confirm.** It needs SELECT/INSERT/UPDATE/DELETE plus CREATE for first-run table creation.

## Built-in protections

- Rate limiting (`backend/src/ratelimit.js`), per IP: 300 API requests per 5 minutes, and 30 new tests per 10 minutes. `/api/health` is exempt. Over the limit returns 429 with `Retry-After` and `RateLimit-*` headers. Behind Hostinger's proxy, set `TRUST_PROXY` so the real client IP is used.
- JSON body limit of 50 kB; strict validation of state, mode, topics, count, question and option IDs.
- All SQL uses `?` placeholders; never build SQL from user input.
- Headers on every response: a Content-Security-Policy allowing only same-origin scripts, styles (plus inline styles, which PrimeVue needs), images, fonts and requests, with `frame-ancestors 'none'`; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: same-origin`; a `Permissions-Policy` that turns off camera, microphone and location; `Strict-Transport-Security` in production only. `x-powered-by` is off. No CORS headers, so other sites can't read the API. Server errors return a generic message; details go to the server log only.
- Production refuses to start without a `mysql://` `DATABASE_URL`.

## Data and privacy

- No names, emails, payment data or IP addresses are stored. Results are kept as described in `docs/DATABASE.md` (24 h for unfinished sessions, newest 200 results per browser, learner can delete).
- No third-party trackers in v1. **Default chosen, please confirm.**
- Privacy policy and terms of use: **UNKNOWN: ask the owner**.
- Content risk: questions describe state law. Every page must show the "not legal advice" disclaimer. Legal review owner: **UNKNOWN: ask the owner**.

## Before launch checklist

- [ ] `npm test` passes; `npm audit` reviewed. Known: high-severity `picomatch` advisories come from node-gyp, which only runs when sqlite3 is built, not at runtime.
- [ ] HTTPS on the production domain (Hostinger SSL). Domain: **UNKNOWN: ask the owner**.
- [ ] `NODE_ENV=production`, `DATABASE_URL`, `TRUST_PROXY=1`, `SITE_URL` set in the host panel; nothing secret in the repo.
- [ ] Rate limits verified behind the real proxy (429 after the limit, per real client IP).
- [ ] Sessions/results moved to MySQL (planned), so redeploys don't lose data.
- [ ] Admin login tested: wrong password, lockout, cookie flags, logout. (Planned feature.)
- [ ] DB backups enabled on Hostinger MySQL. Backup schedule: **UNKNOWN: ask the owner**.
- [ ] Legal review of each state's bank done or clearly flagged.
