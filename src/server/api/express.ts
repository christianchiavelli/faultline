import type { RequestHandler, Response } from 'express';
import { once } from 'node:events';
import type { RateLimiter } from '../http/rate-limit';
import { problem, type ApiResult } from '../http/result';
import { prepareExport } from './export';
import { handleApiRequest } from './router';

/** Express is only the transport here; routing and caching live in `router.ts`. */
export function apiHandler(): RequestHandler {
  return (req, res, next) => {
    const url = new URL(req.originalUrl, 'http://localhost');

    handleApiRequest(req.method, url, req.get('if-none-match') ?? null)
      .then((result) => send(res, result, req.method === 'HEAD'))
      .catch(next);
  };
}

/**
 * `/api/quakes/export`, streamed: rows are written as the USGS pages arrive.
 * The only route that is not a plain `ApiResult`, because its body can run to
 * 20 MB and should reach the reader long before the last page does.
 */
export function exportHandler(prepare = prepareExport): RequestHandler {
  return (req, res, next) => {
    // The reader cancelled the download or closed the tab: stop asking the
    // USGS for pages nobody will read.
    const controller = new AbortController();
    res.on('close', () => controller.abort());

    prepare(new URL(req.originalUrl, 'http://localhost'), controller.signal)
      .then(async (result) => {
        if (!('chunks' in result)) return send(res, result, req.method === 'HEAD');

        res.status(200).set({
          'content-type': result.contentType,
          'content-disposition': `attachment; filename="${result.fileName}"`,
          'cache-control': 'no-store',
        });
        if (req.method === 'HEAD') return void res.end();

        let first = true;
        for await (const chunk of result.chunks) {
          if (!res.write(chunk)) await once(res, 'drain', { signal: controller.signal });
          // Past compression's buffer, so the download starts before the first page arrives.
          if (first) (res as Response & { flush?: () => void }).flush?.();
          first = false;
        }
        res.end();
      })
      .catch((error: unknown) => {
        if (!res.headersSent) return next(error);
        // Headers are gone, so the only honest signal left is a broken
        // connection: the browser marks the download failed instead of
        // saving a file that looks complete and is not.
        if (!controller.signal.aborted) console.warn('[export] cut short', error);
        res.destroy();
      });
  };
}

function send(res: Response, result: ApiResult, head: boolean): void {
  res.status(result.status).set(result.headers);
  if (result.body === undefined || head) res.end();
  else res.send(JSON.stringify(result.body));
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
