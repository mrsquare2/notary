// Question selection, answer shuffling and grading. The answer key never
// leaves the server until a session is graded (practice mode reveals one
// question's answer only after it has been answered and locked).
import { randomUUID, randomInt } from 'node:crypto';

export const PRACTICE_SIZES = [10, 20, 30, 50];
const GRACE_SECONDS = 30; // network slack for a mock exam auto-submitted at 0:00

export function shuffle(items, rand = (n) => randomInt(n)) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Splits `total` across topics in proportion to how many questions each has,
// so a mock exam covers every area roughly as the bank does.
export function allocateByTopic(questions, total) {
  const groups = new Map();
  for (const q of questions) {
    if (!groups.has(q.topic)) groups.set(q.topic, []);
    groups.get(q.topic).push(q);
  }
  const shares = [...groups.entries()].map(([topic, qs]) => {
    const exact = (qs.length / questions.length) * total;
    return { topic, qs, take: Math.min(qs.length, Math.floor(exact)), rem: exact - Math.floor(exact) };
  });
  let left = total - shares.reduce((s, x) => s + x.take, 0);
  // Largest remainder first; random tie-break so the same topics don't always win.
  for (const s of shuffle(shares).sort((a, b) => b.rem - a.rem)) {
    if (left <= 0) break;
    if (s.take < s.qs.length) { s.take++; left--; }
  }
  return shares.flatMap((s) => shuffle(s.qs).slice(0, s.take));
}

export function createSession(state, { mode, topics, count, clientId }) {
  let pool = state.questions;
  let picked;
  let durationSeconds = null;
  if (mode === 'mock') {
    picked = shuffle(allocateByTopic(pool, state.mock.questions));
    durationSeconds = state.mock.minutes * 60;
  } else {
    if (topics?.length) pool = pool.filter((q) => topics.includes(q.topic));
    if (!pool.length) throw new HttpError(400, 'No questions match the selected topics.');
    picked = shuffle(pool).slice(0, Math.min(count, pool.length));
  }
  const now = Date.now();
  return {
    id: randomUUID(),
    clientId,
    state: state.code,
    mode,
    topics: mode === 'mock' ? state.topics.map((t) => t.id) : (topics?.length ? topics : state.topics.map((t) => t.id)),
    createdAt: new Date(now).toISOString(),
    durationSeconds,
    deadline: durationSeconds ? new Date(now + durationSeconds * 1000).toISOString() : null,
    items: picked.map((q) => ({ qid: q.id, order: shuffle(q.options.map((_, i) => i)) })),
    answers: {},
    resultId: null,
  };
}

export function publicSession(session, state) {
  const reveal = session.mode === 'practice';
  return {
    id: session.id,
    state: session.state,
    stateName: state.name,
    mode: session.mode,
    createdAt: session.createdAt,
    deadline: session.deadline,
    durationSeconds: session.durationSeconds,
    serverNow: new Date().toISOString(),
    resultId: session.resultId,
    questions: session.items.map(({ qid, order }) => {
      const q = state.byId.get(qid);
      const out = {
        id: q.id,
        topic: q.topic,
        topicName: state.topicName[q.topic],
        difficulty: q.difficulty,
        text: q.question,
        options: order.map((i) => ({ id: i, text: q.options[i].text })),
        selected: session.answers[qid] ?? null,
      };
      if (reveal && qid in session.answers) Object.assign(out, feedback(q, session.answers[qid]));
      return out;
    }),
  };
}

export function feedback(q, selected) {
  return {
    correct: selected === q.answer,
    correctOptionId: q.answer,
    explanation: q.explanation,
    // Indexed by option id: why each option is right or wrong.
    optionExplanations: q.options.map((o) => o.why),
    source: q.source ?? null,
  };
}

export function isExpired(session, now = Date.now()) {
  return Boolean(session.deadline) && now > Date.parse(session.deadline) + GRACE_SECONDS * 1000;
}

export function recordAnswer(session, state, questionId, optionId) {
  if (session.resultId) throw new HttpError(409, 'This test has already been submitted.');
  const item = session.items.find((i) => i.qid === questionId);
  if (!item) throw new HttpError(400, 'That question is not part of this test.');
  const q = state.byId.get(questionId);
  if (!Number.isInteger(optionId) || optionId < 0 || optionId >= q.options.length) {
    throw new HttpError(400, 'Invalid answer option.');
  }
  if (session.mode === 'practice') {
    // Practice answers lock once the explanation has been shown.
    if (questionId in session.answers) return feedback(q, session.answers[questionId]);
    session.answers[questionId] = optionId;
    return feedback(q, optionId);
  }
  if (isExpired(session)) throw new HttpError(409, 'Time is up for this mock exam.');
  session.answers[questionId] = optionId;
  return { saved: true };
}

export function gradeSession(session, state) {
  const submittedAt = Date.now();
  const byTopic = new Map();
  let correct = 0;
  const questions = session.items.map(({ qid, order }) => {
    const q = state.byId.get(qid);
    const selected = session.answers[qid] ?? null;
    const ok = selected === q.answer;
    if (ok) correct++;
    const t = byTopic.get(q.topic) ?? { topic: q.topic, name: state.topicName[q.topic], total: 0, correct: 0 };
    t.total++;
    if (ok) t.correct++;
    byTopic.set(q.topic, t);
    return {
      id: q.id,
      topic: q.topic,
      topicName: state.topicName[q.topic],
      difficulty: q.difficulty,
      text: q.question,
      options: order.map((i) => ({ id: i, text: q.options[i].text })),
      selected,
      correctOptionId: q.answer,
      isCorrect: ok,
      explanation: q.explanation,
      optionExplanations: q.options.map((o) => o.why),
      source: q.source ?? null,
    };
  });
  const total = questions.length;
  const percent = total ? Math.round((correct / total) * 1000) / 10 : 0;
  const isMock = session.mode === 'mock';
  const elapsed = Math.round((submittedAt - Date.parse(session.createdAt)) / 1000);
  return {
    id: randomUUID(),
    clientId: session.clientId,
    sessionId: session.id,
    state: state.code,
    stateName: state.name,
    mode: session.mode,
    topics: session.topics.map((id) => ({ id, name: state.topicName[id] })),
    startedAt: session.createdAt,
    submittedAt: new Date(submittedAt).toISOString(),
    durationSeconds: session.durationSeconds,
    timeUsedSeconds: isMock ? Math.min(elapsed, session.durationSeconds) : elapsed,
    timedOut: isMock && submittedAt >= Date.parse(session.deadline),
    total,
    answered: questions.filter((q) => q.selected !== null).length,
    correct,
    percent,
    passPercent: isMock ? state.mock.passPercent : null,
    passed: isMock ? percent >= state.mock.passPercent : null,
    byTopic: [...byTopic.values()].map((t) => ({ ...t, percent: Math.round((t.correct / t.total) * 1000) / 10 })),
    questions,
  };
}

export function resultSummary(r) {
  const { questions, clientId, ...rest } = r;
  return rest;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
