import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadStates } from '../src/bank.js';
import { Store } from '../src/store.js';
import { createApp } from '../src/app.js';

const states = loadStates();
let server;
let base;
const CLIENT = 'test-client-0001';

before(async () => {
  const app = createApp({ states, store: new Store(null) });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

async function call(method, path, body, client = CLIENT) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(client ? { 'x-client-id': client } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

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
  assert.equal(s.questions.length, 50);
  assert.equal(s.durationSeconds, 3600);
  assert.ok(s.deadline);

  // Mock answers give no feedback.
  const q = s.questions[0];
  const saved = (await call('POST', `/sessions/${s.id}/answers`, { questionId: q.id, optionId: q.options[1].id })).body;
  assert.deepEqual(saved, { saved: true });

  const { status, body } = await call('POST', `/sessions/${s.id}/submit`);
  assert.equal(status, 201);
  const r = (await call('GET', `/results/${body.resultId}`)).body;
  assert.equal(r.total, 50);
  assert.equal(r.answered, 1);
  assert.equal(r.passPercent, 70);
  assert.equal(typeof r.passed, 'boolean');
  assert.equal(r.byTopic.reduce((n, t) => n + t.total, 0), 50);
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
