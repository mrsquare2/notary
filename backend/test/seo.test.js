import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSeedStates } from '../src/bank.js';
import { Store } from '../src/store.js';
import { createApp } from '../src/app.js';
import { pageMeta, renderPage } from '../src/seo.js';

const states = new Map(readSeedStates().map((s) => [s.code, s]));
const TEMPLATE = '<!doctype html><html><head><title>Default</title><meta name="description" content="x"></head><body><div id="app"></div></body></html>';
let dir;
let server;
let base;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'seo-'));
  writeFileSync(join(dir, 'index.html'), TEMPLATE);
  const app = createApp({ states, store: new Store(null), staticDir: dir, siteUrl: 'https://notary.example' });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

test('each state page has its own title, canonical, FAQ data and readable content', async () => {
  const res = await fetch(`${base}/california`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>California Notary Practice Test: \d+ Explained Questions \| NotaryPrepPro<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/notary\.example\/california">/);
  assert.match(html, /<meta name="robots" content="index,follow">/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'FAQPage');
  assert.ok(ld.mainEntity.length >= 4);
  assert.match(html, /<div id="app"><main class="seo-static">\s*<h1>California notary practice test<\/h1>/);
  assert.match(html, /href="\/new-york"/, 'links to other states');
});

test('Texas copy never claims a state exam exists', () => {
  const tx = pageMeta('/texas', states);
  assert.match(tx.body, /does not give a state-run notary exam/);
  assert.doesNotMatch(tx.title + tx.description, /pass your/i);
});

test('private and unknown pages are kept out of search', async () => {
  for (const p of ['/history', '/quiz/abc', '/results/abc']) {
    const html = await (await fetch(base + p)).text();
    assert.match(html, /noindex,nofollow/, p);
    assert.doesNotMatch(html, /rel="canonical"/, p);
  }
  const missing = await fetch(`${base}/no-such-page`);
  assert.equal(missing.status, 404);
});

test('robots.txt and sitemap.xml point at the site URL and list every state', async () => {
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  assert.match(robots, /Disallow: \/quiz\//);
  assert.match(robots, /Sitemap: https:\/\/notary\.example\/sitemap\.xml/);
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  for (const slug of ['texas', 'new-york', 'california', 'florida']) assert.match(xml, new RegExp(`<loc>https://notary\\.example/${slug}</loc>`));
});

test('content is escaped so data can never inject markup', () => {
  const meta = { status: 200, title: '<script>x</script>', description: '"quoted"', robots: 'index,follow', body: '', jsonLd: { a: '</script><b>' } };
  const html = renderPage(TEMPLATE, meta, { siteUrl: 'https://x', path: '/a"b' });
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.match(html, /&quot;quoted&quot;/);
  assert.doesNotMatch(html, /<\/script><b>/);
  assert.match(html, /href="https:\/\/x\/a&quot;b"/);
});
