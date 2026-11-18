// Copies the JSON question bank (data/states) into the database named by
// DATABASE_URL (default: local SQLite file). Safe to re-run: each state is replaced,
// so edits made directly in the database are overwritten. (Server start only adds
// states that are missing.)
import '../src/env.js';
import { openDb } from '../src/db.js';
import { readSeedStates, seedStates } from '../src/bank.js';

const states = readSeedStates();
const db = await openDb();
try {
  await seedStates(db, states);
  console.log(`Seeded ${db.dialect}: ${states.map((s) => `${s.code} (${s.questions.length})`).join(', ')}`);
} finally {
  await db.close();
}
