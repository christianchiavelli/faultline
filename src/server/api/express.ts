import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { once } from 'node:events';
import { isIPv6 } from 'node:net';
import type { RateLimiter } from '../http/rate-limit';
import { problem, type ApiResult } from '../http/result';
import { prepareExport } from './export';
import type { FeedStreams } from './feed-stream';
import { handleApiRequest } from './router';

/** What `compression` adds to a response: a way to send what it holds without waiting for more. */
type Flushable = Response & { flush?: () => void };

/** A reader who has taken nothing of a file for this long has gone, whatever the connection says. */
const DRAIN_TIMEOUT_MS = 30_000;

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
export function exportHandler(
  prepare = prepareExport,
  drainTimeoutMs = DRAIN_TIMEOUT_MS,
): RequestHandler {
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
          if (!res.write(chunk)) {
            const gone = AbortSignal.timeout(drainTimeoutMs);
            await once(res, 'drain', { signal: AbortSignal.any([controller.signal, gone]) });
          }
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

    const leave = stream.subscribe(
      (chunk) => {
        // The last message is still on its way: this reader has stopped reading.
        // Cut off, its browser opens the stream again and is sent what it missed.
        if (res.writableNeedDrain) return void res.destroy();
        res.write(chunk);
        (res as Flushable).flush?.();
      },
      () => res.end(),
    );
    res.on('close', leave);
  };
}

/**
 * The last word on a failure nothing else answered: logged whole, answered
 * without a trace of it. Express's own handler writes the stack trace into the
 * page wherever `NODE_ENV` is not `production`.
 */
export function errorHandler(): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    console.error(`[server] ${req.method} ${req.originalUrl}`, error);
    // Too late for a status: Express cuts the connection, so the reader sees it fail.
    if (res.headersSent) return next(error);

    const failed = problem(500, 'Something went wrong on our side');
    if (req.path.startsWith('/api/')) {
      res.status(500).set(failed.headers).send(JSON.stringify(failed.body));
    } else {
      res.status(500).type('text/plain').send('Something went wrong on our side.');
    }
  };
}

function send(res: Response, result: ApiResult, head: boolean): void {
  res.status(result.status).set(result.headers);
  if (result.body === undefined || head) res.end();
  else res.send(JSON.stringify(result.body));
}

/** Who is asking, as far as limits go: the address, or what the proxy says it is under `trust proxy`. */
function clientOf(req: Request): string {
  return clientKey(req.ip ?? req.socket.remoteAddress ?? 'unknown');
}

/**
 * The address limits count by. An IPv4 address reached over IPv6 is the IPv4
 * address. An IPv6 address counts by its first 56 bits: a home or a phone is
 * handed a /56 or a /64 of its own, and taking a new address from it would
 * otherwise be a new client to every limit.
 */
export function clientKey(address: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return mapped[1]!;
  if (!isIPv6(address)) return address;
  const groups = expandIPv6(address);
  return `${groups.slice(0, 3).join(':')}:${groups[3]!.slice(0, 2)}00::/56`;
}

/** The eight groups of an IPv6 address, four hex digits each: "2001:db8::1" in full. */
function expandIPv6(address: string): string[] {
  let text = address.split('%')[0]!.toLowerCase();
  // An IPv4 address in the last 32 bits, as in "64:ff9b::192.0.2.1", is two groups.
  const ipv4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (ipv4) {
    const [a, b, c, d] = ipv4.slice(1).map(Number) as [number, number, number, number];
    text =
      text.slice(0, ipv4.index) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = '', tail] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return groups.map((group) => group.padStart(4, '0'));
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
