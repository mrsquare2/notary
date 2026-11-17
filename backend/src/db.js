// One small interface over SQLite (local) and MySQL (production): all(), run(), close().
// DATABASE_URL=mysql://user:pass@host:3306/dbname selects MySQL; anything else
// is a SQLite file path (default data/notary.db, or ":memory:" for tests).
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SQLITE_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'notary.db');

export async function openDb(url = process.env.DATABASE_URL || DEFAULT_SQLITE_FILE) {
  const db = /^mysql:\/\//i.test(url) ? await openMysql(url) : await openSqlite(url);
  for (const sql of schema(db.dialect)) await db.run(sql);
  return db;
}

async function openSqlite(file) {
  const { default: sqlite3 } = await import('sqlite3');
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const conn = await new Promise((resolve, reject) => {
    const d = new sqlite3.Database(file, (err) => (err ? reject(err) : resolve(d)));
  });
  const call = (method, sql, params) => new Promise((resolve, reject) => {
    conn[method](sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
  return {
    dialect: 'sqlite',
    all: (sql, params = []) => call('all', sql, params),
    run: async (sql, params = []) => { await call('run', sql, params); },
    close: () => new Promise((resolve, reject) => conn.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function openMysql(url) {
  const { default: mysql } = await import('mysql2/promise');
  const conn = await mysql.createConnection({ uri: url, charset: 'utf8mb4' });
  return {
    dialect: 'mysql',
    all: async (sql, params = []) => (await conn.query(sql, params))[0],
    run: async (sql, params = []) => { await conn.query(sql, params); },
    close: () => conn.end(),
  };
}

// Column types are chosen to mean the same thing in SQLite and MySQL.
function schema(dialect) {
  const opts = dialect === 'mysql' ? ' DEFAULT CHARSET=utf8mb4' : '';
  return [
    `CREATE TABLE IF NOT EXISTS states (
      code VARCHAR(8) NOT NULL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      authority VARCHAR(255),
      notes TEXT,
      disclaimer TEXT,
      mock_questions INT NOT NULL,
      mock_minutes INT NOT NULL,
      pass_percent INT NOT NULL
    )${opts}`,
    `CREATE TABLE IF NOT EXISTS topics (
      state_code VARCHAR(8) NOT NULL,
      id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      idx INT NOT NULL,
      PRIMARY KEY (state_code, id)
    )${opts}`,
    `CREATE TABLE IF NOT EXISTS questions (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      state_code VARCHAR(8) NOT NULL,
      topic VARCHAR(64) NOT NULL,
      difficulty VARCHAR(8) NOT NULL,
      question TEXT NOT NULL,
      answer INT NOT NULL,
      explanation TEXT NOT NULL,
      source VARCHAR(255)
    )${opts}`,
    `CREATE TABLE IF NOT EXISTS question_options (
      question_id VARCHAR(64) NOT NULL,
      idx INT NOT NULL,
      option_text TEXT NOT NULL,
      why TEXT NOT NULL,
      PRIMARY KEY (question_id, idx)
    )${opts}`,
  ];
}
