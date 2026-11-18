import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';

const result = (id, clientId) => ({ id, clientId, submittedAt: new Date().toISOString() });

test('results are capped store-wide, dropping the oldest, even across many client ids', () => {
  const store = new Store(null, { maxTotal: 3 });
  for (let i = 1; i <= 5; i++) store.saveResult(result(`r${i}`, `client-${i}-abcd`));
  assert.deepEqual([...store.results.keys()], ['r3', 'r4', 'r5']);
});
