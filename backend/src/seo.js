// Search-engine foundation without a server-rendering framework: the built
// index.html gets per-page <head> tags and readable HTML inside #app, which the
// Vue app replaces when it mounts. Also builds robots.txt and sitemap.xml.

export const BRAND = 'NotaryPrepPro'; // working name; change here and in frontend/src/brand.js

export const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Pages that hold one learner's data never belong in search results.
const PRIVATE = /^\/(quiz|results)\/|^\/history\/?$/;

export function faqFor(state) {
  const topicNames = state.topics.map((t) => t.name).join(', ');
  const { questions, minutes, passPercent } = state.mock;
  return [
    { q: `Is there a state notary exam in ${state.name}?`, a: state.notes ?? '' },
    {
      q: `How many ${state.name} practice questions are there?`,
      a: `${state.questions.length} questions across ${state.topics.length} topics: ${topicNames}. Every answer option explains why it is right or wrong, and every question cites the law it is based on.`,
    },
    {
      q: 'How does the timed mock exam work?',
      a: `You get ${questions} questions drawn from every topic in proportion to its size, ${minutes} minutes on the clock and no feedback until you submit. You need ${passPercent}% to pass, then you see a score by topic and a full answer review.`,
    },
    { q: `Is ${BRAND} free?`, a: 'Yes. There is no sign-up. Your results are saved in your own browser only.' },
    { q: 'Is this legal advice?', a: state.disclaimer ?? 'No. It is a study aid, not legal advice.' },
  ].filter((f) => f.a);
}

function stateBody(state, states) {
  // A few easy questions as readable samples, one from each of the first topics.
  const samples = state.topics.slice(0, 3)
    .map((t) => state.questions.find((q) => q.topic === t.id && q.difficulty === 'easy') ?? state.questions.find((q) => q.topic === t.id))
    .filter(Boolean);
  return `<main class="seo-static">
<h1>${esc(state.name)} notary practice test</h1>
<p>${esc(state.questions.length)} free practice questions for the ${esc(state.name)} notary public commission, each answer explained and cited to the law. ${esc(state.notes)}</p>
<h2>Topics</h2>
<ul>${state.topics.map((t) => `<li><strong>${esc(t.name)}</strong> (${state.questions.filter((q) => q.topic === t.id).length} questions): ${esc(t.description)}</li>`).join('')}</ul>
<h2>Sample questions</h2>
${samples.map((q) => `<section><h3>${esc(q.question)}</h3><ol type="A">${q.options.map((o) => `<li>${esc(o.text)}: ${esc(o.why)}</li>`).join('')}</ol><p>Source: ${esc(q.source)}</p></section>`).join('\n')}
<h2>Frequently asked questions</h2>
<dl>${faqFor(state).map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl>
<h2>Other states</h2>
<ul>${states.filter((s) => s.code !== state.code).map((s) => `<li><a href="/${slugOf(s.name)}">${esc(s.name)} notary practice test</a></li>`).join('')}</ul>
</main>`;
}

function homeBody(states) {
  return `<main class="seo-static">
<h1>Free notary practice tests</h1>
<p>Practice questions and timed mock exams for new notaries public, with every answer explained and cited to the law. No sign-up.</p>
<ul>${states.map((s) => `<li><a href="/${slugOf(s.name)}">${esc(s.name)} notary practice test</a> (${s.questions.length} questions)</li>`).join('')}</ul>
</main>`;
}

// Returns { status, title, description, robots, body, jsonLd } for a request path.
export function pageMeta(path, statesMap) {
  const states = [...statesMap.values()];
  const clean = path.replace(/\/+$/, '') || '/';
  const bySlug = new Map(states.map((s) => [`/${slugOf(s.name)}`, s]));
  const names = states.map((s) => s.code).join(', ');

  if (clean === '/') {
    return {
      status: 200,
      title: `${BRAND} | Free Notary Practice Tests (${names})`,
      description: `Free notary public practice questions and timed mock exams for ${states.map((s) => s.name).join(', ')}. Every answer explained and cited. No sign-up.`,
      robots: 'index,follow',
      body: homeBody(states),
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND },
    };
  }
  const state = bySlug.get(clean);
  if (state) {
    const faq = faqFor(state);
    return {
      status: 200,
      title: `${state.name} Notary Practice Test: ${state.questions.length} Explained Questions | ${BRAND}`,
      description: `Free ${state.name} notary practice questions and a timed ${state.mock.questions}-question mock exam. Every answer explained and cited to ${state.name} law. No sign-up.`,
      robots: 'index,follow',
      body: stateBody(state, states),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    };
  }
  if (clean === '/practice') return { status: 200, title: `Topic Practice | ${BRAND}`, description: 'Drill notary law by topic with instant, explained feedback on every answer.', robots: 'index,follow' };
  if (clean === '/mock') return { status: 200, title: `Timed Mock Exam | ${BRAND}`, description: 'Take a timed notary mock exam in your state\'s format, then review every answer.', robots: 'index,follow' };
  if (PRIVATE.test(clean)) return { status: 200, title: BRAND, description: '', robots: 'noindex,nofollow' };
  return { status: 404, title: `Page not found | ${BRAND}`, description: '', robots: 'noindex,nofollow' };
}

// Fills the built index.html. siteUrl has no trailing slash.
export function renderPage(template, meta, { siteUrl, path }) {
  const canonical = meta.robots.startsWith('index') ? `${siteUrl}${path.replace(/\/+$/, '') || '/'}` : null;
  // JSON-LD is data, not script; escape "<" so content can never close the tag.
  const ld = meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>` : '';
  const head = [
    `<meta name="robots" content="${meta.robots}">`,
    canonical && `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:site_name" content="${BRAND}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    meta.description && `<meta property="og:description" content="${esc(meta.description)}">`,
    canonical && `<meta property="og:url" content="${esc(canonical)}">`,
    '<meta property="og:type" content="website">',
    ld,
  ].filter(Boolean).join('\n    ');
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, meta.description ? `<meta name="description" content="${esc(meta.description)}">` : '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="app"></div>', `<div id="app">${meta.body ?? ''}</div>`);
}

export function robotsTxt(siteUrl) {
  return ['User-agent: *', 'Disallow: /api/', 'Disallow: /quiz/', 'Disallow: /results/', 'Disallow: /history', '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}

export function sitemapXml(siteUrl, statesMap) {
  const paths = ['/', ...[...statesMap.values()].map((s) => `/${slugOf(s.name)}`), '/practice', '/mock'];
  const urls = paths.map((p) => `  <url><loc>${esc(siteUrl + (p === '/' ? '/' : p))}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
