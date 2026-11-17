import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStates } from '../src/bank.js';
import { shuffle, allocateByTopic } from '../src/quiz.js';

const states = loadStates();
const tx = states.get('TX');

test('Texas bank loads and passes validation', () => {
  assert.ok(tx, 'TX bank should load');
});

test('Texas bank has at least 150 questions', () => {
  assert.ok(tx.questions.length >= 150, `only ${tx.questions.length} questions`);
});

test('required practice areas exist and are populated', () => {
  for (const id of ['identification', 'acknowledgments', 'jurats', 'fees', 'recordkeeping']) {
    const n = tx.questions.filter((q) => q.topic === id).length;
    assert.ok(n >= 10, `${id} has only ${n} questions`);
  }
});

test('every question has a source citation', () => {
  for (const q of tx.questions) assert.ok(q.source?.trim(), `${q.id} has no source`);
});

test('question text is unique', () => {
  const texts = tx.questions.map((q) => q.question.trim().toLowerCase());
  assert.equal(new Set(texts).size, texts.length);
});

test('shuffle keeps every element and does not mutate input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(input);
  assert.deepEqual([...out].sort(), [...input].sort());
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('shuffle actually reorders over many runs', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) seen.add(shuffle([1, 2, 3, 4]).join(''));
  assert.ok(seen.size > 5);
});

test('mock allocation hits the exact count and covers every topic', () => {
  const picked = allocateByTopic(tx.questions, tx.mock.questions);
  assert.equal(picked.length, tx.mock.questions);
  assert.equal(new Set(picked.map((q) => q.id)).size, picked.length);
  assert.equal(new Set(picked.map((q) => q.topic)).size, tx.topics.length);
});
