// Fixed-window, per-IP request limiter kept in memory.
// shortcut: counts are per process, so N server processes allow N× the limit; move to Redis/MySQL if you scale out.
import { HttpError } from './quiz.js';

export function rateLimit({ windowMs, max, message = 'Too many requests. Please wait a moment and try again.', now = Date.now }) {
  const hits = new Map();
  let nextSweep = now() + windowMs;
  return (req, res, next) => {
    const t = now();
    if (t >= nextSweep) {
      for (const [key, h] of hits) if (h.reset <= t) hits.delete(key);
      nextSweep = t + windowMs;
    }
    let h = hits.get(req.ip);
    if (!h || h.reset <= t) hits.set(req.ip, (h = { count: 0, reset: t + windowMs }));
    h.count++;
    const resetSeconds = Math.ceil((h.reset - t) / 1000);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - h.count)));
    res.set('RateLimit-Reset', String(resetSeconds));
    if (h.count > max) {
      res.set('Retry-After', String(resetSeconds));
      return next(new HttpError(429, message));
    }
    next();
  };
}
