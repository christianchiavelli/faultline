import type { NextFunction, Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import { createRateLimiter } from '../http/rate-limit';
import { problem } from '../http/result';
import { clientRateLimit, exportHandler, feedStreamHandler } from './express';
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

class StreamedResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  written = '';
  body: unknown;
  ended = false;
  destroyed = false;
  headersSent = false;

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
    return true;
  }
  send(body: string) {
    this.headersSent = true;
    this.body = JSON.parse(body);
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
): Promise<StreamedResponse> {
  const res = new StreamedResponse();
  const next = vi.fn();
  exportHandler(prepare)(
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

  it('answers HEAD with the headers alone, without paging the USGS', async () => {
    const body = { [Symbol.asyncIterator]: vi.fn() };

    const res = await run(file(body), 'HEAD');

    expect(res.headers['content-disposition']).toContain('faultline.csv');
    expect(body[Symbol.asyncIterator]).not.toHaveBeenCalled();
  });
});

describe('feedStreamHandler', () => {
  /** A stream that hands the spec its writer, and notes when the reader leaves. */
  function aStream() {
    const stream = { write: undefined as StreamWrite | undefined, left: false };
    const streams = {
      open: vi.fn(() => ({
        subscribe: (write: StreamWrite) => {
          stream.write = write;
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
