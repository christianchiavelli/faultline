import type { RequestHandler } from 'express';
import type { RateLimiter } from '../http/rate-limit';
import { problem } from '../http/result';
import { handleApiRequest } from './router';

/** Express is only the transport here; routing and caching live in `router.ts`. */
export function apiHandler(): RequestHandler {
  return (req, res, next) => {
    const url = new URL(req.originalUrl, 'http://localhost');

    handleApiRequest(req.method, url, req.get('if-none-match') ?? null)
      .then((result) => {
        res.status(result.status).set(result.headers);
        if (result.body === undefined || req.method === 'HEAD') res.end();
        else res.send(JSON.stringify(result.body));
      })
      .catch(next);
  };
}

/**
 * Per-client limit for everything that can reach the USGS: API calls and
 * server-rendered pages, which look events up in-process. Static files are
 * mounted before it and never count.
 */
export function clientRateLimit(limiter: RateLimiter): RequestHandler {
  return (req, res, next) => {
    const decision = limiter.take(req.ip ?? req.socket.remoteAddress ?? 'unknown');
    if (decision.allowed) return next();

    const limited = problem(
      429,
      'Too many requests',
      `Try again in ${decision.retryAfterSeconds} s.`,
    );
    res
      .status(429)
      .set({ ...limited.headers, 'retry-after': String(decision.retryAfterSeconds) })
      .send(JSON.stringify(limited.body));
  };
}
