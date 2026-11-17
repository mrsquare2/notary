import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStates } from './bank.js';
import { Store } from './store.js';
import { createApp } from './app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 4100;

const states = loadStates();
const store = new Store(process.env.DATA_DIR || join(root, 'data', 'runtime'));
const app = createApp({ states, store, staticDir: join(root, '..', 'frontend', 'dist') });

app.listen(port, () => {
  const summary = [...states.values()].map((s) => `${s.code} (${s.questions.length} questions)`).join(', ');
  console.log(`Notary exam API on http://localhost:${port} — banks: ${summary || 'none'}`);
});
