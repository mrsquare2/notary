// Loads and validates every state's question bank from data/states/<code>/.
// A state folder holds state.json (name, topics, mock-exam settings) plus one
// <topic>.json file per topic containing an array of questions.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'states');

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
    if (!q.question?.trim()) errors.push(`${where}: empty question text`);
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${where}: needs at least 2 options`);
    else {
      if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) {
        errors.push(`${where}: duplicate option text`);
      }
      if (q.options.some((o) => /\b(all|none|both) of the above\b/i.test(o))) {
        errors.push(`${where}: "of the above" options break when answers are shuffled`);
      }
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

export function loadStates(dir = DEFAULT_DIR) {
  const states = new Map();
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
    const errors = validateState(state);
    if (errors.length) throw new Error(`Invalid question bank:\n  ${errors.join('\n  ')}`);
    state.byId = new Map(questions.map((q) => [q.id, q]));
    state.topicName = Object.fromEntries(meta.topics.map((t) => [t.id, t.name]));
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
    authority: state.authority,
    notes: state.notes,
    disclaimer: state.disclaimer,
    questionCount: state.questions.length,
    topics: state.topics.map((t) => ({ ...t, count: counts[t.id] ?? 0 })),
    mock: state.mock,
  };
}
