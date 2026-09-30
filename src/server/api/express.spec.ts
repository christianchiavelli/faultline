import type { NextFunction, Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import { createRateLimiter } from '../http/rate-limit';
import { clientRateLimit, exportHandler } from './express';

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
