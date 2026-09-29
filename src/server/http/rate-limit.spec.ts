import { createRateLimiter } from './rate-limit';

function setup(capacity = 3, refillPerSecond = 1, maxKeys?: number) {
  let now = 0;
  const limiter = createRateLimiter({ capacity, refillPerSecond, maxKeys, now: () => now });
  return {
    limiter,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('createRateLimiter', () => {
  it('allows a burst up to its capacity, then refuses', () => {
    const { limiter } = setup(3);

    expect([1, 2, 3, 4].map(() => limiter.take('a').allowed)).toEqual([true, true, true, false]);
  });

  it('says how long to wait before the next request would pass', () => {
    const { limiter } = setup(1, 0.5);
    limiter.take('a');

    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterSeconds: 2 });
  });

  it('refills at the sustained rate, never beyond capacity', () => {
    const { limiter, advance } = setup(2, 1);
    limiter.take('a');
    limiter.take('a');

    advance(1_000);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);

    advance(60_000);
    expect([1, 2, 3].map(() => limiter.take('a').allowed)).toEqual([true, true, false]);
  });

  it('keeps clients apart', () => {
    const { limiter } = setup(1);
    limiter.take('a');

    expect(limiter.take('a').allowed).toBe(false);
    expect(limiter.take('b').allowed).toBe(true);
  });

  it('forgets the least recently seen client beyond its bound', () => {
    const { limiter } = setup(1, 1, 2);
    limiter.take('a');
    limiter.take('b');
    limiter.take('c');

    // `a` was evicted, so it starts again with a full bucket.
    expect(limiter.take('a').allowed).toBe(true);
  });
});
