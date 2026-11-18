// The question bank lives in the database (SQLite locally, MySQL in production).
// data/states/<code>/ holds the reviewed seed: state.json (name, topics, mock
// settings) plus one <topic>.json per topic. `npm run db:seed` copies it in.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faqFor, slugOf } from './seo.js';

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'states');
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${path}: ${err.message}`);
  }
}

export function validateState(state) {
  const errors = [];
  const topicIds = new Set(state.topics.map((t) => t.id));
  const seen = new Set();
  for (const q of state.questions) {
    const where = `${state.code}/${q.id ?? '(no id)'}`;
    if (!q.id || seen.has(q.id)) errors.push(`${where}: missing or duplicate id`);
    seen.add(q.id);
    if (!topicIds.has(q.topic)) errors.push(`${where}: unknown topic "${q.topic}"`);
    if (!DIFFICULTIES.includes(q.difficulty)) errors.push(`${where}: difficulty must be one of ${DIFFICULTIES.join(', ')}`);
    if (!q.question?.trim()) errors.push(`${where}: empty question text`);
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${where}: needs at least 2 options`);
    else {
      const texts = q.options.map((o) => String(o?.text ?? '').trim().toLowerCase());
      if (texts.some((t) => !t)) errors.push(`${where}: empty option text`);
      if (new Set(texts).size !== texts.length) errors.push(`${where}: duplicate option text`);
      if (texts.some((t) => /\b(all|none|both) of the above\b/.test(t))) {
        errors.push(`${where}: "of the above" options break when answers are shuffled`);
      }
      if (q.options.some((o) => !o?.why?.trim())) errors.push(`${where}: every option needs a "why" explanation`);
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0)) {
      errors.push(`${where}: answer index out of range`);
    }
    if (!q.explanation?.trim()) errors.push(`${where}: missing explanation`);
  }
  const { questions: mockCount, minutes, passPercent } = state.mock ?? {};
  if (!(mockCount > 0 && mockCount <= state.questions.length)) errors.push(`${state.code}: invalid mock question count`);
  if (!(minutes > 0)) errors.push(`${state.code}: invalid mock duration`);
  if (!(passPercent > 0 && passPercent <= 100)) errors.push(`${state.code}: invalid pass percentage`);
  return errors;
}

function assertValid(state) {
  const errors = validateState(state);
  if (errors.length) throw new Error(`Invalid question bank:\n  ${errors.join('\n  ')}`);
}

// Reads and validates the JSON seed files. Returns plain state objects.
export function readSeedStates(dir = DEFAULT_DIR) {
  const states = [];
  if (!existsSync(dir)) return states;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = join(dir, entry.name);
    const metaPath = join(folder, 'state.json');
    if (!existsSync(metaPath)) continue;
    const meta = readJson(metaPath);
    const questions = [];
    for (const topic of meta.topics) {
      const file = join(folder, `${topic.id}.json`);
      if (existsSync(file)) questions.push(...readJson(file));
    }
    const state = { ...meta, code: meta.code.toUpperCase(), questions };
    assertValid(state);
    states.push(state);
  }
  return states;
}

// Replaces each given state's rows in one transaction, so a failed seed
// leaves the previous bank intact.
export async function seedStates(db, states) {
  for (const s of states) {
    await db.run('BEGIN');
    try {
      await db.run('DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE state_code = ?)', [s.code]);
      await db.run('DELETE FROM questions WHERE state_code = ?', [s.code]);
      await db.run('DELETE FROM topics WHERE state_code = ?', [s.code]);
      await db.run('DELETE FROM states WHERE code = ?', [s.code]);
      await db.run(
        'INSERT INTO states (code, name, authority, notes, disclaimer, mock_questions, mock_minutes, pass_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [s.code, s.name, s.authority ?? null, s.notes ?? null, s.disclaimer ?? null, s.mock.questions, s.mock.minutes, s.mock.passPercent],
      );
      for (const [i, t] of s.topics.entries()) {
        await db.run('INSERT INTO topics (state_code, id, name, description, idx) VALUES (?, ?, ?, ?, ?)', [s.code, t.id, t.name, t.description ?? null, i]);
      }
      for (const q of s.questions) {
        await db.run(
          'INSERT INTO questions (id, state_code, topic, difficulty, question, answer, explanation, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [q.id, s.code, q.topic, q.difficulty, q.question, q.answer, q.explanation, q.source ?? null],
        );
        for (const [i, o] of q.options.entries()) {
          await db.run('INSERT INTO question_options (question_id, idx, option_text, why) VALUES (?, ?, ?, ?)', [q.id, i, o.text, o.why]);
        }
      }
      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  }
}

// Seeds only the states the database doesn't have yet (first deploy, or a newly added
// state). Never touches existing states, so edits made in the database survive restarts.
// Returns the codes it added.
export async function seedMissingStates(db, states) {
  const have = new Set((await db.all('SELECT code FROM states')).map((r) => r.code));
  const missing = states.filter((s) => !have.has(s.code));
  await seedStates(db, missing);
  return missing.map((s) => s.code);
}

// Loads every state from the database into memory (the bank is small and
// read-only at runtime), validated and indexed for the quiz engine.
export async function loadStates(db) {
  const [stateRows, topicRows, questionRows, optionRows] = await Promise.all([
    db.all('SELECT * FROM states ORDER BY code'),
    db.all('SELECT * FROM topics ORDER BY state_code, idx'),
    db.all('SELECT * FROM questions ORDER BY state_code, id'),
    db.all('SELECT * FROM question_options ORDER BY question_id, idx'),
  ]);
  const optionsByQ = new Map();
  for (const o of optionRows) {
    if (!optionsByQ.has(o.question_id)) optionsByQ.set(o.question_id, []);
    optionsByQ.get(o.question_id).push({ text: o.option_text, why: o.why });
  }
  const states = new Map();
  for (const r of stateRows) {
    const topics = topicRows.filter((t) => t.state_code === r.code)
      .map((t) => ({ id: t.id, name: t.name, description: t.description ?? undefined }));
    const questions = questionRows.filter((q) => q.state_code === r.code).map((q) => ({
      id: q.id,
      topic: q.topic,
      difficulty: q.difficulty,
      question: q.question,
      options: optionsByQ.get(q.id) ?? [],
      answer: Number(q.answer),
      explanation: q.explanation,
      source: q.source ?? undefined,
    }));
    const state = {
      code: r.code,
      name: r.name,
      authority: r.authority ?? undefined,
      notes: r.notes ?? undefined,
      disclaimer: r.disclaimer ?? undefined,
      mock: { questions: Number(r.mock_questions), minutes: Number(r.mock_minutes), passPercent: Number(r.pass_percent) },
      topics,
      questions,
    };
    assertValid(state);
    state.byId = new Map(questions.map((q) => [q.id, q]));
    state.topicName = Object.fromEntries(topics.map((t) => [t.id, t.name]));
    states.set(state.code, state);
  }
  return states;
}

export function stateSummary(state) {
  const counts = {};
  for (const q of state.questions) counts[q.topic] = (counts[q.topic] ?? 0) + 1;
  return {
    code: state.code,
    name: state.name,
    slug: slugOf(state.name),
    faq: faqFor(state), // same Q&As as the page's FAQ structured data
    authority: state.authority,
    notes: state.notes,
    disclaimer: state.disclaimer,
    questionCount: state.questions.length,
    topics: state.topics.map((t) => ({ ...t, count: counts[t.id] ?? 0 })),
    mock: state.mock,
  };
}
