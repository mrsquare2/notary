// Builds the deployable app: dist/ (serverEntry.js at its root) and dist/serverEntry.zip.
//
//   SITE_URL=https://yourdomain.com npm run package      (or: npm run package -- --site-url=https://...)
//
//   dist/                 (at the repository root: it holds both frontend and backend)
//     data/states/        question seed; an empty database is filled from it on first start
//     public/             built web app: assets/, icons/, index.html, fonts/, media/,
//                         plus static robots.txt and sitemap.xml for SITE_URL
//     scripts/            runtime scripts (seed.js for `npm run db:seed`)
//     src/                backend code
//     uploads/            empty; reserved for user uploads
//     .env.example
//     package.json        production dependencies only
//     package-lock.json   resolved for that package.json
//     serverEntry.js      single entry file (start command: node serverEntry.js)
//     serverEntry.zip     everything above, zipped (the zip doesn't include itself)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipDirectory } from './zip.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(root, p);
const dist = rel('dist');

const flag = process.argv.find((a) => a.startsWith('--site-url='));
const siteUrl = (flag ? flag.slice('--site-url='.length) : process.env.SITE_URL ?? '').trim().replace(/\/+$/, '');
if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(siteUrl)) {
  console.error('Set the public address first, e.g.  SITE_URL=https://www.example.com npm run package');
  console.error('robots.txt and sitemap.xml are static files and need the real domain.');
  process.exit(1);
}

console.log('› Building the web app…');
execSync('npm --prefix frontend run build', { cwd: root, stdio: 'inherit' });

// Validates every state's seed files (throws on bad data) before anything is copied.
const { readSeedStates } = await import(pathToFileURL(rel('backend/src/bank.js')));
const { robotsTxt, sitemapXml } = await import(pathToFileURL(rel('backend/src/seo.js')));
const states = new Map(readSeedStates().map((s) => [s.code, s]));

console.log('› Assembling dist/…');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(rel('backend/serverEntry.js'), path.join(dist, 'serverEntry.js'));
fs.cpSync(rel('backend/src'), path.join(dist, 'src'), { recursive: true });
fs.cpSync(rel('backend/scripts'), path.join(dist, 'scripts'), { recursive: true });
fs.mkdirSync(path.join(dist, 'uploads'));
fs.writeFileSync(path.join(dist, 'uploads/.gitkeep'), ''); // zip tools drop empty folders
fs.cpSync(rel('backend/data/states'), path.join(dist, 'data/states'), { recursive: true });
fs.cpSync(rel('frontend/dist'), path.join(dist, 'public'), { recursive: true });
fs.writeFileSync(path.join(dist, 'public/robots.txt'), robotsTxt(siteUrl));
fs.writeFileSync(path.join(dist, 'public/sitemap.xml'), sitemapXml(siteUrl, states));

const backendPkg = JSON.parse(fs.readFileSync(rel('backend/package.json'), 'utf8').replace(/^﻿/, ''));
const { sqlite3, ...deps } = backendPkg.dependencies;
const prodPkg = {
  name: 'notaryprep',
  version: backendPkg.version,
  private: true,
  description: 'NotaryPrepPro: notary exam practice (API + web app)',
  type: 'module',
  main: 'serverEntry.js',
  engines: backendPkg.engines,
  scripts: { start: 'node serverEntry.js', 'db:seed': 'node scripts/seed.js' },
  dependencies: deps,
  // Production uses MySQL; SQLite is only for running locally, so a failed native build can't break the install.
  optionalDependencies: { sqlite3 },
  allowScripts: backendPkg.allowScripts,
};
fs.writeFileSync(path.join(dist, 'package.json'), `${JSON.stringify(prodPkg, null, 2)}\n`);
fs.writeFileSync(path.join(dist, '.env.example'), [
  '# Copy to .env, or set these in the hosting panel. Never commit real values.',
  'NODE_ENV=production',
  '# PORT is usually provided by the host',
  'PORT=4100',
  'DATABASE_URL=mysql://user:password@localhost:3306/notaryprep',
  `SITE_URL=${siteUrl}`,
  '# Number of proxy hops in front of the app (Hostinger: 1)',
  'TRUST_PROXY=1',
  '',
].join('\n'));

console.log('› Resolving package-lock.json…');
// Lockfile only: resolves exact versions without downloading anything into dist/node_modules.
execSync('npm install --package-lock-only --ignore-scripts --no-audit --no-fund', { cwd: dist, stdio: 'inherit' });

console.log('› Zipping…');
const tmpZip = path.join(os.tmpdir(), `serverEntry-${process.pid}.zip`);
const entries = zipDirectory(dist, tmpZip);
fs.renameSync(tmpZip, path.join(dist, 'serverEntry.zip'));
const kb = Math.round(fs.statSync(path.join(dist, 'serverEntry.zip')).size / 1024);

console.log(`✓ dist/serverEntry.zip (${entries.length} files, ${kb} KB) for ${siteUrl}`);
console.log('  Upload and unzip, set the env vars from .env.example, run `npm install --omit=dev`,');
console.log('  then start serverEntry.js. The first start fills an empty database with the questions.');
