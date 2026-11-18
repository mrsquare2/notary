import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { pageMeta, renderPage } from './seo.js';
import { join } from 'node:path';
import { stateSummary } from './bank.js';
import {
  PRACTICE_SIZES, createSession, publicSession, recordAnswer, gradeSession, resultSummary, HttpError,
} from './quiz.js';
import { rateLimit } from './ratelimit.js';

const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;

// Same-origin only. 'unsafe-inline' styles: PrimeVue injects its theme as <style> tags at runtime.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// Per IP. A full 50-question mock is ~55 requests, so `api` leaves plenty of
// room for real learners while stopping scripted hammering.
export const DEFAULT_LIMITS = {
  api: { windowMs: 5 * 60 * 1000, max: 300 },
  newSession: { windowMs: 10 * 60 * 1000, max: 30, message: 'Too many tests started. Please wait a few minutes.' },
};

export function createApp({ states, store, staticDir, limits = DEFAULT_LIMITS, hsts = false, siteUrl = null }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '50kb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.set('X-Frame-Options', 'DENY'); // older browsers that ignore frame-ancestors
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // HTTPS-only hint; only in production, where the site is served over TLS.
    if (hsts) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  });

  const api = express.Router();

  // Registered before the limiter so load-balancer health checks are never throttled.
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.use(rateLimit(limits.api));
  const newSessionLimit = rateLimit(limits.newSession);

  // Learners are anonymous: the browser keeps a random id and sends it with
  // every request, so each browser sees only its own sessions and results.
  api.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/states') return next();
    const id = req.get('x-client-id');
    if (!id || !CLIENT_ID.test(id)) return next(new HttpError(400, 'Missing or invalid client id.'));
    req.clientId = id;
    next();
  });

  const getState = (code) => {
    const state = states.get(String(code ?? '').toUpperCase());
    if (!state) throw new HttpError(404, 'Unknown state.');
    return state;
  };

  const ownSession = (req) => {
    const session = store.getSession(req.params.id);
    if (!session || session.clientId !== req.clientId) throw new HttpError(404, 'Test not found or expired.');
    return { session, state: getState(session.state) };
  };

  const ownResult = (req) => {
    const result = store.getResult(req.params.id);
    if (!result || result.clientId !== req.clientId) throw new HttpError(404, 'Result not found.');
    return result;
  };

  api.get('/states', (req, res) => {
    res.json({ states: [...states.values()].map(stateSummary), practiceSizes: PRACTICE_SIZES });
  });

  api.post('/sessions', newSessionLimit, (req, res) => {
    const { state: code, mode, topics, count } = req.body ?? {};
    const state = getState(code);
    if (mode !== 'practice' && mode !== 'mock') throw new HttpError(400, 'Mode must be "practice" or "mock".');
    let topicList = [];
    if (mode === 'practice') {
      if (topics !== undefined && !Array.isArray(topics)) throw new HttpError(400, 'Topics must be a list.');
      topicList = [...new Set(topics ?? [])];
      const known = new Set(state.topics.map((t) => t.id));
      if (topicList.some((t) => !known.has(t))) throw new HttpError(400, 'Unknown topic.');
      if (!PRACTICE_SIZES.includes(count)) throw new HttpError(400, `Count must be one of ${PRACTICE_SIZES.join(', ')}.`);
    }
    const session = createSession(state, { mode, topics: topicList, count, clientId: req.clientId });
    store.saveSession(session);
    res.status(201).json(publicSession(session, state));
  });

  api.get('/sessions/:id', (req, res) => {
    const { session, state } = ownSession(req);
    res.json(publicSession(session, state));
  });

  api.post('/sessions/:id/answers', (req, res) => {
    const { session, state } = ownSession(req);
    const { questionId, optionId } = req.body ?? {};
    const out = recordAnswer(session, state, questionId, optionId);
    store.saveSession(session);
    res.json(out);
  });

  api.post('/sessions/:id/submit', (req, res) => {
    const { session, state } = ownSession(req);
    if (session.resultId) return res.json({ resultId: session.resultId });
    const result = gradeSession(session, state);
    session.resultId = result.id;
    store.saveResult(result);
    store.saveSession(session);
    res.status(201).json({ resultId: result.id });
  });

  api.get('/results', (req, res) => {
    res.json({ results: store.listResults(req.clientId).map(resultSummary) });
  });

  api.get('/results/:id', (req, res) => {
    const { clientId, ...result } = ownResult(req);
    res.json(result);
  });

  api.delete('/results/:id', (req, res) => {
    ownResult(req);
    store.deleteResult(req.params.id);
    res.status(204).end();
  });

  api.use((req, res) => res.status(404).json({ error: 'Not found.' }));

  app.use('/api', api);

  // Absolute links for canonical tags. SITE_URL is the source of truth in production;
  // otherwise fall back to the request's host (validated, never echoed raw).
  // robots.txt and sitemap.xml are static files written by `npm run package`.
  const baseUrl = (req) => {
    if (siteUrl) return siteUrl.replace(/\/+$/, '');
    const host = req.get('host');
    return `${req.protocol}://${/^[a-z0-9.-]+(:\d+)?$/i.test(host ?? '') ? host : 'localhost'}`;
  };

  // Production: serve the built Vue app. Every page gets its own <head> and readable
  // content for search engines; the client router takes over once the app loads.
  if (staticDir && existsSync(staticDir)) {
    const template = readFileSync(join(staticDir, 'index.html'), 'utf8');
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (req, res) => {
      const meta = pageMeta(req.path, states);
      res.status(meta.status).set('Cache-Control', 'no-cache')
        .type('html').send(renderPage(template, meta, { siteUrl: baseUrl(req), path: req.path }));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status ?? (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong.' : err.message });
  });

  return app;
}
