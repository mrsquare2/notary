import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { loadStates } from './bank.js';
import { Store } from './store.js';
import { createApp } from './app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 4100;

if (process.env.NODE_ENV === 'production' && !/^mysql:\/\//i.test(process.env.DATABASE_URL ?? '')) {
  console.error('Production needs DATABASE_URL=mysql://user:pass@host:3306/dbname');
  process.exit(1);
}

// The bank is read once at startup; re-seed and restart to pick up changes.
const db = await openDb();
const states = await loadStates(db).finally(() => db.close());
if (!states.size) {
  console.error(`The question bank in ${db.dialect} is empty. Run \`npm run db:seed\` first.`);
  process.exit(1);
}

// Behind a reverse proxy, set TRUST_PROXY to the number of proxy hops (usually 1) so rate
// limits key on the real client IP. "true" would trust any X-Forwarded-For a client sends.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy && !/^\d+$/.test(trustProxy)) {
  console.error('TRUST_PROXY must be a number of proxy hops, e.g. TRUST_PROXY=1');
  process.exit(1);
}

const store = new Store(process.env.DATA_DIR || join(root, 'data', 'runtime'));
const app = createApp({
  states,
  store,
  staticDir: join(root, '..', 'frontend', 'dist'),
  hsts: process.env.NODE_ENV === 'production',
  siteUrl: process.env.SITE_URL || null, // e.g. https://www.example.com; used for canonical links and the sitemap
});
if (trustProxy) app.set('trust proxy', Number(trustProxy));

app.listen(port, () => {
  const summary = [...states.values()].map((s) => `${s.code} (${s.questions.length} questions)`).join(', ');
  console.log(`Notary exam API on http://localhost:${port} (${db.dialect}) — banks: ${summary}`);
});
