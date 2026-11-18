import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readSeedStates, seedStates, loadStates } from '../src/bank.js';
import { openDb } from '../src/db.js';
import { Store } from '../src/store.js';
import { createApp, DEFAULT_LIMITS } from '../src/app.js';

// Same path as production: JSON seed -> database -> in-memory bank.
const db = await openDb(':memory:');
await seedStates(db, readSeedStates());
const states = await loadStates(db);
await db.close();

let server;
let base;
let limited; // a second app with tiny limits, for the 429 tests
const CLIENT = 'test-client-0001';

const listen = (app) => new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
const urlOf = (s) => `http://127.0.0.1:${s.address().port}/api`;

before(async () => {
  server = await listen(createApp({ states, store: new Store(null) }));
  base = urlOf(server);
  limited = await listen(createApp({
    states,
    store: new Store(null),
    limits: { api: { windowMs: 60_000, max: 5 }, newSession: { windowMs: 60_000, max: 2 } },
  }));
});
after(() => { server.close(); limited.close(); });

async function call(method, path, body, client = CLIENT, root = base) {
  const res = await fetch(root + path, {
    method,
    headers: { 'content-type': 'application/json', ...(client ? { 'x-client-id': client } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

test('every state is served with its questions', async () => {
  const { body } = await call('GET', '/states', null, null);
  for (const code of ['TX', 'NY', 'CA', 'FL']) {
    const s = body.states.find((x) => x.code === code);
    assert.ok(s?.questionCount >= 150, `${code} missing or too small`);
  }
});

test('practice feedback explains every option and mock results include them', async () => {
  const s = (await call('POST', '/sessions', { state: 'NY', mode: 'practice', count: 10 })).body;
  const q = s.questions[0];
  assert.ok(['easy', 'medium', 'hard'].includes(q.difficulty));
  assert.ok(!('optionExplanations' in q), 'explanations leaked before answering');
  const fb = (await call('POST', `/sessions/${s.id}/answers`, { questionId: q.id, optionId: q.options[0].id })).body;
  for (const o of q.options) assert.ok(fb.optionExplanations[o.id]?.length > 10, 'option explanation missing');

  const m = (await call('POST', '/sessions', { state: 'CA', mode: 'mock' })).body;
  const r = (await call('GET', `/results/${(await call('POST', `/sessions/${m.id}/submit`)).body.resultId}`)).body;
  assert.ok(r.questions.every((x) => x.options.every((o) => x.optionExplanations[o.id])));
});

test('rate limit: too many requests from one IP get 429 with Retry-After', async () => {
  const seen = [];
  for (let i = 0; i < 6; i++) seen.push((await call('GET', '/states', null, null, urlOf(limited))).status);
  assert.deepEqual(seen, [200, 200, 200, 200, 200, 429]);
  const res = await call('GET', '/states', null, null, urlOf(limited));
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get('retry-after')) > 0);
  assert.match(res.body.error, /too many/i);
  // Health checks are never throttled.
  assert.equal((await call('GET', '/health', null, null, urlOf(limited))).status, 200);
});

test('responses carry security headers (no HSTS outside production)', async () => {
  const res = await fetch(`${base}/health`);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'.*frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('strict-transport-security'), null);
  assert.equal(res.headers.get('access-control-allow-origin'), null, 'API must not opt into CORS');
});

test('default limits leave room for a full mock exam', () => {
  assert.ok(DEFAULT_LIMITS.api.max >= 100);
  assert.ok(DEFAULT_LIMITS.newSession.max >= 10);
});

test('lists states with topic counts', async () => {
  const { status, body } = await call('GET', '/states', null, null);
  assert.equal(status, 200);
  const tx = body.states.find((s) => s.code === 'TX');
  assert.ok(tx.questionCount >= 150);
  assert.ok(tx.topics.every((t) => t.count > 0));
});

test('requires a client id', async () => {
  const { status } = await call('POST', '/sessions', { state: 'TX', mode: 'mock' }, null);
  assert.equal(status, 400);
});

test('practice session filters by topic, hides answers, and gives feedback', async () => {
  const { status, body: s } = await call('POST', '/sessions', { state: 'tx', mode: 'practice', topics: ['fees'], count: 10 });
  assert.equal(status, 201);
  assert.equal(s.questions.length, 10);
  assert.ok(s.questions.every((q) => q.topic === 'fees'));
  assert.ok(s.questions.every((q) => !('correctOptionId' in q)), 'answer key leaked');

  const q = s.questions[0];
  const fb = (await call('POST', `/sessions/${s.id}/answers`, { questionId: q.id, optionId: q.options[0].id })).body;
  assert.equal(typeof fb.correct, 'boolean');
  assert.ok(fb.explanation);

  // A practice answer is locked once feedback is shown.
  const other = q.options.find((o) => o.id !== q.options[0].id).id;
  const again = (await call('POST', `/sessions/${s.id}/answers`, { questionId: q.id, optionId: other })).body;
  assert.equal(again.correct, fb.correct);
});

test('options are shuffled across sessions', async () => {
  const orders = new Set();
  for (let i = 0; i < 8; i++) {
    const s = (await call('POST', '/sessions', { state: 'TX', mode: 'practice', topics: ['identification'], count: 10 })).body;
    const q = s.questions.find((x) => x.id === 'tx-id-02') ?? s.questions[0];
    orders.add(q.options.map((o) => o.id).join(''));
  }
  assert.ok(orders.size > 1, 'option order never changed');
});

test('mock exam: timed, graded with pass/fail and topic breakdown', async () => {
  const { body: s } = await call('POST', '/sessions', { state: 'TX', mode: 'mock' });
  assert.equal(s.questions.length, 20);
  assert.equal(s.durationSeconds, 1800);
  assert.ok(s.deadline);

  // Mock answers give no feedback.
  const q = s.questions[0];
  const saved = (await call('POST', `/sessions/${s.id}/answers`, { questionId: q.id, optionId: q.options[1].id })).body;
  assert.deepEqual(saved, { saved: true });

  const { status, body } = await call('POST', `/sessions/${s.id}/submit`);
  assert.equal(status, 201);
  const r = (await call('GET', `/results/${body.resultId}`)).body;
  assert.equal(r.total, 20);
  assert.equal(r.answered, 1);
  assert.equal(r.passPercent, 70);
  assert.equal(typeof r.passed, 'boolean');
  assert.equal(r.byTopic.reduce((n, t) => n + t.total, 0), 20);
  assert.ok(r.questions.every((x) => Number.isInteger(x.correctOptionId)));

  // Submitting twice returns the same result; answering afterwards is refused.
  assert.equal((await call('POST', `/sessions/${s.id}/submit`)).body.resultId, body.resultId);
  assert.equal((await call('POST', `/sessions/${s.id}/answers`, { questionId: q.id, optionId: 0 })).status, 409);
});

test('results are private to the browser that created them', async () => {
  const { body: s } = await call('POST', '/sessions', { state: 'TX', mode: 'practice', count: 10 });
  const { body } = await call('POST', `/sessions/${s.id}/submit`);
  assert.equal((await call('GET', `/results/${body.resultId}`, null, 'someone-else-999')).status, 404);
  assert.equal((await call('GET', `/sessions/${s.id}`, null, 'someone-else-999')).status, 404);
  const mine = (await call('GET', '/results')).body.results;
  assert.ok(mine.some((r) => r.id === body.resultId));
  assert.ok(mine.every((r) => !('questions' in r)));
});

test('rejects bad input', async () => {
  assert.equal((await call('POST', '/sessions', { state: 'ZZ', mode: 'mock' })).status, 404);
  assert.equal((await call('POST', '/sessions', { state: 'TX', mode: 'practice', count: 7 })).status, 400);
  assert.equal((await call('POST', '/sessions', { state: 'TX', mode: 'practice', count: 10, topics: ['nope'] })).status, 400);
  assert.equal((await call('POST', '/sessions', { state: 'TX', mode: 'exam' })).status, 400);
});
