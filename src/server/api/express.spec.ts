import type { NextFunction, Request, Response } from 'express';
import { createRateLimiter } from '../http/rate-limit';
import { clientRateLimit } from './express';

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
