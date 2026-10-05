import type { NextFunction, Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import { createRateLimiter } from '../http/rate-limit';
import { problem } from '../http/result';
import {
  clientKey,
  clientRateLimit,
  errorHandler,
  exportHandler,
  feedStreamHandler,
} from './express';
import type { FeedStreams, StreamWrite } from './feed-stream';

function fakeResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    set(headers: Record<string, string>) {
      Object.assign(response.headers, headers);
      return response;
    },
    send(body: string) {
      response.body = JSON.parse(body);
      return response;
    },
  };
  return response;
}

describe('clientRateLimit', () => {
  it('lets requests through until the client runs out, then answers 429 with Retry-After', () => {
    const middleware = clientRateLimit(createRateLimiter({ capacity: 1, refillPerSecond: 0.2 }));
    const request = { ip: '203.0.113.7', socket: {} } as Request;
    const next = vi.fn() as NextFunction;

    middleware(request, fakeResponse() as unknown as Response, next);
    const limited = fakeResponse();
    middleware(request, limited as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBe('5');
    expect(limited.body).toMatchObject({ status: 429, title: 'Too many requests' });
  });
});

describe('clientKey', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    // IPv4 reached over IPv6 is the same reader.
    ['::ffff:203.0.113.7', '203.0.113.7'],
    // Two addresses from one /56 are one client; another /56 is another.
    ['2001:db8:1:2345::1', '2001:0db8:0001:2300::/56'],
    ['2001:db8:1:23ff:aaaa:bbbb:cccc:dddd', '2001:0db8:0001:2300::/56'],
    ['2001:db8:1:2400::1', '2001:0db8:0001:2400::/56'],
    ['fe80::1%eth0', 'fe80:0000:0000:0000::/56'],
    ['64:ff9b::192.0.2.1', '0064:ff9b:0000:0000::/56'],
  ])('counts %s as %s', (address, key) => {
    expect(clientKey(address)).toBe(key);
  });
});

class StreamedResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  written = '';
  body: unknown;
  ended = false;
  destroyed = false;
  headersSent = false;
  /** What the socket says: the last write is still waiting to go out. */
  writableNeedDrain = false;
  /** Whether a write is taken at once, or waits for `drain`. */
  accepts = true;

  status(code: number) {
    this.statusCode = code;
    return this;
  }
  set(headers: Record<string, string>) {
    Object.assign(this.headers, headers);
    return this;
  }
  write(chunk: string) {
    this.headersSent = true;
    this.written += chunk;
    return this.accepts;
  }
  type(type: string) {
    this.headers['content-type'] = type;
    return this;
  }
  send(body: string) {
    this.headersSent = true;
    this.body = this.headers['content-type']?.includes('json') ? JSON.parse(body) : body;
    this.ended = true;
    return this;
  }
  end() {
    this.ended = true;
    return this;
  }
  destroy() {
    this.destroyed = true;
    return this;
  }
}

async function run(
  prepare: Parameters<typeof exportHandler>[0],
  method = 'GET',
  res = new StreamedResponse(),
): Promise<StreamedResponse> {
  const next = vi.fn();
  exportHandler(prepare, 20)(
    { method, originalUrl: '/api/quakes/export?from=x' } as Request,
    res as unknown as Response,
    next as NextFunction,
  );
  await vi.waitFor(() =>
    expect(res.ended || res.destroyed || next.mock.calls.length > 0).toBe(true),
  );
  return res;
}

async function* chunks(...parts: string[]): AsyncGenerator<string> {
  yield* parts;
}

describe('exportHandler', () => {
  const file = (body: AsyncIterable<string>) =>
    vi.fn().mockResolvedValue({ fileName: 'faultline.csv', contentType: 'text/csv', chunks: body });

  it('streams the file as an attachment with its name', async () => {
    const res = await run(file(chunks('time\r\n', 'row\r\n')));

    expect(res.headers).toMatchObject({
      'content-disposition': 'attachment; filename="faultline.csv"',
      'cache-control': 'no-store',
    });
    expect(res.written).toBe('time\r\nrow\r\n');
    expect(res.ended).toBe(true);
  });

  it('answers a refusal as a problem document, before any byte of a file', async () => {
    const refused = vi.fn().mockResolvedValue({
      status: 422,
      headers: { 'content-type': 'application/problem+json' },
      body: { title: 'Too many events for one file' },
    });

    const res = await run(refused);

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({ title: 'Too many events for one file' });
  });

  it('cuts the connection when the file fails halfway, instead of ending it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    async function* failing(): AsyncGenerator<string> {
      yield 'time\r\n';
      throw new Error('USGS search answered 503');
    }

    const res = await run(file(failing()));

    expect(res.written).toBe('time\r\n');
    expect(res.destroyed).toBe(true);
    expect(res.ended).toBe(false);
  });

  it('lets a reader go who stops taking the file, rather than hold its export open', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const stalled = Object.assign(new StreamedResponse(), { accepts: false });

    const res = await run(file(chunks('time\r\n', 'row\r\n')), 'GET', stalled);

    expect(res.written).toBe('time\r\n');
    expect(res.destroyed).toBe(true);
  });

  it('answers HEAD with the headers alone, without paging the USGS', async () => {
    const body = { [Symbol.asyncIterator]: vi.fn() };

    const res = await run(file(body), 'HEAD');

    expect(res.headers['content-disposition']).toContain('faultline.csv');
    expect(body[Symbol.asyncIterator]).not.toHaveBeenCalled();
  });
});

describe('feedStreamHandler', () => {
  /** A stream that hands the spec its writer and its way to end, and notes when the reader leaves. */
  function aStream() {
    const stream = {
      write: undefined as StreamWrite | undefined,
      end: undefined as (() => void) | undefined,
      left: false,
    };
    const streams = {
      open: vi.fn(() => ({
        subscribe: (write: StreamWrite, end: () => void) => {
          Object.assign(stream, { write, end });
          return () => (stream.left = true);
        },
      })),
    };
    return { stream, streams: streams as unknown as FeedStreams };
  }

  function serve(streams: FeedStreams, headers: Record<string, string> = {}, method = 'GET') {
    const res = Object.assign(new StreamedResponse(), { flush: vi.fn() });
    const request = {
      method,
      originalUrl: '/api/quakes/recent/stream?window=day',
      ip: '203.0.113.7',
      socket: {},
      get: (name: string) => headers[name.toLowerCase()],
    } as unknown as Request;
    feedStreamHandler(streams)(request, res as unknown as Response, vi.fn());
    return res;
  }

  it('opens an event stream, and sends each message on as it is written', () => {
    const { stream, streams } = aStream();
    const res = serve(streams, { 'last-event-id': '1727784000000-f' });

    stream.write!('event: change\n\n');
    stream.write!(':\n\n');

    expect(streams.open).toHaveBeenCalledWith(expect.any(URL), '203.0.113.7', '1727784000000-f');
    expect(res.headers).toMatchObject({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
    });
    expect(res.written).toBe('event: change\n\n:\n\n');
    expect(res.flush).toHaveBeenCalledTimes(2);
  });

  it('lets go of the stream when the reader leaves', () => {
    const { stream, streams } = aStream();
    const res = serve(streams);

    res.emit('close');

    expect(stream.left).toBe(true);
  });

  it('cuts off a reader who has stopped reading, for its browser to open the stream again', () => {
    const { stream, streams } = aStream();
    const res = serve(streams);
    stream.write!('event: feed\n\n');

    res.writableNeedDrain = true;
    stream.write!('event: change\n\n');

    expect(res.written).toBe('event: feed\n\n');
    expect(res.destroyed).toBe(true);
  });

  it('ends the response when the stream ends it, as the server shuts down', () => {
    const { stream, streams } = aStream();
    const res = serve(streams);

    stream.end!();

    expect(res.ended).toBe(true);
  });

  it('answers a refusal as a problem document', () => {
    const refusing = {
      open: () => problem(429, 'Too many open streams'),
    } as unknown as FeedStreams;

    const res = serve(refusing);

    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ title: 'Too many open streams' });
  });

  it('answers HEAD with the headers alone, reading nothing', () => {
    const { stream, streams } = aStream();

    const res = serve(streams, {}, 'HEAD');

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.ended).toBe(true);
    expect(stream.write).toBeUndefined();
  });
});

describe('errorHandler', () => {
  function fail(path: string, headersSent = false) {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = Object.assign(new StreamedResponse(), { headersSent });
    const next = vi.fn();
    const error = new Error('render failed at line 12');
    errorHandler()(
      error,
      { method: 'GET', path, originalUrl: path } as Request,
      res as unknown as Response,
      next as NextFunction,
    );
    return { res, next, error };
  }

  it('answers an API call with a problem document, and nothing of the error', () => {
    const { res } = fail('/api/quakes/recent');

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ title: 'Something went wrong on our side' });
    expect(JSON.stringify(res.body)).not.toContain('line 12');
    expect(console.error).toHaveBeenCalledWith(
      '[server] GET /api/quakes/recent',
      expect.any(Error),
    );
  });

  it('answers a page in plain words, and nothing of the error', () => {
    const { res } = fail('/quakes/us7000big');

    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toBe('text/plain');
  });

  it('leaves a response already under way for Express to cut off', () => {
    const { next, error } = fail('/api/quakes/export', true);

    expect(next).toHaveBeenCalledWith(error);
  });
});
