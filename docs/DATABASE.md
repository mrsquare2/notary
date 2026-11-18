# Database

Never rename or delete a table or field without asking the owner. Column types are chosen to mean the same thing in SQLite and MySQL (`utf8mb4` on MySQL). Schema is created by `backend/src/db.js` (`CREATE TABLE IF NOT EXISTS`); there is no migration tool yet. Any schema change needs a migration plan for the production MySQL data first.

## Source of truth

- **Decision:** once the admin screen ships, the **database is the master copy** of questions.
- The JSON files in `backend/data/states/` are the initial seed and a reviewable backup format.
- **Planned change:** `db:seed` must only fill a state that is missing from the DB and must never overwrite an existing state. The `predev` auto-seed must follow the same rule. An admin "Export JSON" writes the current DB bank back to the seed format. Server start already follows this rule (it only adds missing states). **`db:seed` and `predev` still overwrite** (see `docs/ARCHITECTURE.md`).

## Tables (built)

### `states`
| Field | Type | Notes |
|---|---|---|
| code | VARCHAR(8) PK | `TX`, `NY`, `CA`, `FL` |
| name, authority | VARCHAR | Display name, commissioning authority |
| notes, disclaimer | TEXT | Shown on screen |
| mock_questions, mock_minutes, pass_percent | INT | Mock exam format |

### `topics`
| Field | Type | Notes |
|---|---|---|
| state_code + id | PK | e.g. `NY` + `fees` |
| name | VARCHAR(255) | |
| description | TEXT | |
| idx | INT | Display order |

### `questions`
| Field | Type | Notes |
|---|---|---|
| id | VARCHAR(64) PK | Globally unique, prefixed by state (`ny-fee-03`) |
| state_code, topic | VARCHAR | |
| difficulty | VARCHAR(8) | `easy`, `medium` or `hard` |
| question | TEXT | |
| answer | INT | Index into `question_options.idx` of the correct option |
| explanation | TEXT | Summary shown after answering |
| source | VARCHAR(255) | Legal citation; required by tests |

### `question_options`
| Field | Type | Notes |
|---|---|---|
| question_id + idx | PK | Original (unshuffled) order |
| option_text | TEXT | |
| why | TEXT | Starts with "Correct." or "Wrong." and explains why |

### `question_refs`
| Field | Type | Notes |
|---|---|---|
| question_id + idx | PK | Display order |
| title | VARCHAR(255) | e.g. `Tex. Gov't Code §406.014` or a handbook section heading |
| url | VARCHAR(1024) | `https://` link to the official text: the state legislature's statute page or the commissioning authority's handbook. Checked by hand against the question. |

Validation rules (enforced in `bank.js` on seed and load): unique IDs, a known topic, a valid difficulty, at least 2 options with no duplicates, no "all/none/both of the above", every option has a `why`, the answer index is in range, and any `refs` have a title and an `https://` link. **Planned:** `refs` becomes required once every state's references are checked.

## Tables (planned)

### `sessions` (replaces `data/runtime/sessions.json`)
id (UUID PK), client_id, state_code, mode (`practice`/`mock`), topics (JSON text), created_at, duration_seconds, deadline, items (JSON text: question IDs + option order), answers (JSON text), result_id. Unfinished sessions expire after 24 hours.

### `results` (replaces `data/runtime/results.json`)
id (UUID PK), client_id, session_id, state_code, mode, submitted_at, total, correct, percent, passed, payload (JSON text of the full review). Keep the newest 200 per client_id; learners may delete their own.

### `admin_audit`
id, at (timestamp), action (`create`/`update`/`retire`/`export`), entity, entity_id, before (JSON), after (JSON). Every admin change writes a row. **Default chosen, please confirm.**

Retiring questions: **Default chosen, please confirm.** Add `questions.retired` (BOOLEAN, default false) rather than deleting rows, so old results still resolve their question IDs.

## Who may read or change what

| Data | Learner (anonymous browser) | Admin (planned) | Server/seed |
|---|---|---|---|
| states, topics, questions, options | Read, but the answer key and `why` notes only after answering (practice) or submitting (mock) | Read + change | Seed fills missing states only (planned) |
| sessions | Only their own (matched by `client_id`) | Aggregate counts only | Create/update |
| results | Read and delete only their own | Aggregate counts only | Create |
| admin_audit | None | Read | Append-only |

No personal data (names, emails, IP addresses) is stored. `client_id` is a random anonymous browser ID. This must match `docs/SECURITY.md`.
