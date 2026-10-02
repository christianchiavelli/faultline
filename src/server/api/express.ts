import type { Request, RequestHandler, Response } from 'express';
import { once } from 'node:events';
import type { RateLimiter } from '../http/rate-limit';
import { problem, type ApiResult } from '../http/result';
import { prepareExport } from './export';
import type { FeedStreams } from './feed-stream';
import { handleApiRequest } from './router';

/** What `compression` adds to a response: a way to send what it holds without waiting for more. */
type Flushable = Response & { flush?: () => void };

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
          if (first) (res as Flushable).flush?.();
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

/**
 * `/api/quakes/recent/stream`, the feed as server-sent events (`feed-stream.ts`).
 * Each message is flushed as it is written: `compression` compresses an event
 * stream like any text, and would otherwise hold a message back until enough
 * others came to fill its buffer.
 */
export function feedStreamHandler(streams: FeedStreams): RequestHandler {
  return (req, res) => {
    const url = new URL(req.originalUrl, 'http://localhost');
    const stream = streams.open(url, clientOf(req), req.get('last-event-id') ?? null);
    if (!('subscribe' in stream)) return send(res, stream, req.method === 'HEAD');

    res.status(200).set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      // nginx buffers what it proxies unless told otherwise, which would hold every message back.
      'x-accel-buffering': 'no',
    });
    if (req.method === 'HEAD') return void res.end();

    const leave = stream.subscribe((chunk) => {
      res.write(chunk);
      (res as Flushable).flush?.();
    });
    res.on('close', leave);
  };
}

function send(res: Response, result: ApiResult, head: boolean): void {
  res.status(result.status).set(result.headers);
  if (result.body === undefined || head) res.end();
  else res.send(JSON.stringify(result.body));
}

/** Who is asking, as far as limits go: the address, or what the proxy says it is under `trust proxy`. */
function clientOf(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/**
 * Per-client limit for everything that can reach the USGS: API calls and
 * server-rendered pages, which look events up in-process. Static files are
 * mounted before it and never count.
 */
export function clientRateLimit(limiter: RateLimiter): RequestHandler {
  return (req, res, next) => {
    const decision = limiter.take(clientOf(req));
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
