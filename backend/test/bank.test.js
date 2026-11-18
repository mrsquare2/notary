import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSeedStates, seedStates, seedMissingStates, loadStates, validateState, DIFFICULTIES } from '../src/bank.js';
import { openDb } from '../src/db.js';
import { shuffle, allocateByTopic, feedback } from '../src/quiz.js';

const seed = readSeedStates(); // throws if any bank fails validation
const states = new Map(seed.map((s) => [s.code, s]));
const tx = states.get('TX');

test('TX, NY, CA and FL banks load and pass validation', () => {
  for (const code of ['TX', 'NY', 'CA', 'FL']) assert.ok(states.has(code), `${code} bank missing`);
});

test('every state has at least 150 questions, 600+ in total', () => {
  for (const s of seed) assert.ok(s.questions.length >= 150, `${s.code} has only ${s.questions.length} questions`);
  assert.ok(seed.reduce((n, s) => n + s.questions.length, 0) >= 600);
});

test('core practice areas exist and are populated in every state', () => {
  for (const s of seed) {
    for (const id of ['identification', 'acknowledgments', 'jurats', 'fees', 'recordkeeping']) {
      const n = s.questions.filter((q) => q.topic === id).length;
      assert.ok(n >= 10, `${s.code}/${id} has only ${n} questions`);
    }
    for (const t of s.topics) assert.ok(s.questions.some((q) => q.topic === t.id), `${s.code}/${t.id} is empty`);
  }
});

test('every state mixes easy, medium and hard questions', () => {
  for (const s of seed) {
    for (const d of DIFFICULTIES) {
      const share = s.questions.filter((q) => q.difficulty === d).length / s.questions.length;
      assert.ok(share >= 0.15, `${s.code} has only ${Math.round(share * 100)}% ${d} questions`);
    }
  }
});

test('every option explains why it is right or wrong', () => {
  for (const s of seed) {
    for (const q of s.questions) {
      for (const [i, o] of q.options.entries()) {
        assert.ok(o.why.trim().length >= 25, `${q.id} option ${i} has a thin explanation`);
        const verdict = i === q.answer ? /^correct\b/i : /^wrong\b/i;
        assert.match(o.why, verdict, `${q.id} option ${i} should start with "${i === q.answer ? 'Correct' : 'Wrong'}"`);
      }
    }
  }
});

test('every question has a source citation and unique text', () => {
  for (const s of seed) {
    for (const q of s.questions) assert.ok(q.source?.trim(), `${q.id} has no source`);
    const texts = s.questions.map((q) => q.question.trim().toLowerCase());
    assert.equal(new Set(texts).size, texts.length, `${s.code} has duplicate question text`);
  }
});

test('question ids are unique across all states (they share one table)', () => {
  const ids = seed.flatMap((s) => s.questions.map((q) => q.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('validator rejects a missing option explanation and a bad difficulty', () => {
  const bad = structuredClone(tx);
  bad.questions[0].options[1].why = ' ';
  bad.questions[1].difficulty = 'tricky';
  const errors = validateState(bad);
  assert.ok(errors.some((e) => e.includes('"why"')));
  assert.ok(errors.some((e) => e.includes('difficulty')));
});

test('validator rejects refs without a title or an https link', () => {
  for (const refs of [[], [{ title: 'x', url: 'http://example.gov' }], [{ title: ' ', url: 'https://example.gov' }]]) {
    const bad = structuredClone(tx);
    bad.questions[0].refs = refs;
    assert.ok(validateState(bad).some((e) => e.includes('ref')), JSON.stringify(refs));
  }
});

test('refs survive seeding and loading, and reach the learner after answering', async () => {
  const db = await openDb(':memory:');
  try {
    const withRefs = structuredClone(tx);
    const q = withRefs.questions[0];
    q.refs = [{ title: 'Tex. Gov\'t Code §406.014', url: 'https://statutes.capitol.texas.gov/Docs/GV/htm/GV.406.htm#406.014' }];
    await seedStates(db, [withRefs]);
    await seedStates(db, [withRefs]); // re-seeding replaces refs instead of duplicating them
    const back = (await loadStates(db)).get('TX').byId.get(q.id);
    assert.deepEqual(back.refs, q.refs);
    assert.deepEqual(feedback(back, 0).refs, q.refs);
  } finally {
    await db.close();
  }
});

test('seeding SQLite and loading back returns the same bank', async () => {
  const db = await openDb(':memory:');
  try {
    await seedStates(db, seed);
    await seedStates(db, seed); // re-seeding replaces rows instead of duplicating them
    const loaded = await loadStates(db);
    assert.deepEqual([...loaded.keys()].sort(), [...states.keys()].sort());
    for (const s of seed) {
      const got = loaded.get(s.code);
      assert.equal(got.questions.length, s.questions.length);
      assert.deepEqual(got.mock, s.mock);
      assert.deepEqual(got.topics.map((t) => t.id), s.topics.map((t) => t.id));
      const q = s.questions[0];
      const back = got.byId.get(q.id);
      assert.deepEqual(back.options, q.options);
      assert.equal(back.answer, q.answer);
      assert.equal(back.difficulty, q.difficulty);
    }
  } finally {
    await db.close();
  }
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
  for (const s of seed) {
    const picked = allocateByTopic(s.questions, s.mock.questions);
    assert.equal(picked.length, s.mock.questions);
    assert.equal(new Set(picked.map((q) => q.id)).size, picked.length);
    assert.equal(new Set(picked.map((q) => q.topic)).size, s.topics.length, `${s.code} mock misses a topic`);
  }
});

test('server-start seeding fills only missing states and never overwrites existing ones', async () => {
  const db = await openDb(':memory:');
  try {
    await seedStates(db, seed.filter((s) => s.code === 'TX'));
    await db.run("UPDATE questions SET explanation = 'edited in the database' WHERE id = 'tx-fee-01'");
    const added = await seedMissingStates(db, seed);
    assert.deepEqual(added.sort(), ['CA', 'FL', 'NY']);
    const loaded = await loadStates(db);
    assert.equal(loaded.size, 4);
    assert.equal(loaded.get('TX').byId.get('tx-fee-01').explanation, 'edited in the database');
    assert.deepEqual(await seedMissingStates(db, seed), [], 'a second start adds nothing');
  } finally {
    await db.close();
  }
});
