import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ROOT } from './env.js';
import { openDb } from './db.js';
import { loadStates, readSeedStates, seedMissingStates } from './bank.js';
import { Store } from './store.js';
import { createApp } from './app.js';

// Starts the API and web server. Throws (instead of exiting) so serverEntry.js reports why.
export async function start() {
  const port = Number(process.env.PORT) || 4100;

  if (process.env.NODE_ENV === 'production' && !/^mysql:\/\//i.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('Production needs DATABASE_URL=mysql://user:pass@host:3306/dbname');
  }
  // Behind a reverse proxy, set TRUST_PROXY to the number of proxy hops (usually 1) so rate
  // limits key on the real client IP. "true" would trust any X-Forwarded-For a client sends.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy && !/^\d+$/.test(trustProxy)) throw new Error('TRUST_PROXY must be a number of proxy hops, e.g. TRUST_PROXY=1');

  // The bank is read once at startup. An empty database (first deploy) is filled from the
  // bundled seed; states already in the database are never overwritten here.
  const db = await openDb();
  let states;
  try {
    const added = await seedMissingStates(db, readSeedStates());
    if (added.length) console.log(`Seeded new states into ${db.dialect}: ${added.join(', ')}`);
    states = await loadStates(db);
  } finally {
    await db.close();
  }
  if (!states.size) throw new Error(`The question bank in ${db.dialect} is empty and no seed files were found.`);

  // Deploy package: <root>/public. Repository: frontend/dist next to backend/.
  const staticDir = process.env.STATIC_DIR || [join(APP_ROOT, 'public'), join(APP_ROOT, '..', 'frontend', 'dist')].find(existsSync);
  const store = new Store(process.env.DATA_DIR || join(APP_ROOT, 'data', 'runtime'));
  const app = createApp({
    states,
    store,
    staticDir,
    hsts: process.env.NODE_ENV === 'production',
    siteUrl: process.env.SITE_URL || null, // e.g. https://www.example.com; used for canonical links
  });
  if (trustProxy) app.set('trust proxy', Number(trustProxy));

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const summary = [...states.values()].map((s) => `${s.code} (${s.questions.length} questions)`).join(', ');
      console.log(`Notary exam API on http://localhost:${port} (${db.dialect}) — banks: ${summary}`);
      resolve(server);
    });
  });
}
