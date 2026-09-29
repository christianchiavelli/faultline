export interface RateLimitOptions {
  /** Requests allowed in a burst. */
  readonly capacity: number;
  /** Tokens returned per second: the sustained rate. */
  readonly refillPerSecond: number;
  /** Keys tracked at once. The least recently seen are forgotten first. */
  readonly maxKeys?: number;
  readonly now?: () => number;
}

export interface RateDecision {
  readonly allowed: boolean;
  /** Whole seconds until a request would be allowed, for `Retry-After`. */
  readonly retryAfterSeconds: number;
}

interface Bucket {
  readonly tokens: number;
  readonly updatedAt: number;
}

/**
 * Token bucket per key. Bursts up to `capacity`, then `refillPerSecond`
 * sustained, so a reader clicking through events is never limited and a
 * script walking random ids is.
 *
 * In memory, so the limit is per instance. That is the right cost for one
 * Node process; several instances behind a balancer would move this to the
 * edge or to a shared store.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { capacity, refillPerSecond, maxKeys = 10_000, now = Date.now } = options;
  const buckets = new Map<string, Bucket>();

  function take(key: string): RateDecision {
    const time = now();
    const bucket = buckets.get(key);
    const elapsedSeconds = bucket ? (time - bucket.updatedAt) / 1000 : 0;
    const tokens = Math.min(
      capacity,
      (bucket?.tokens ?? capacity) + elapsedSeconds * refillPerSecond,
    );

    const allowed = tokens >= 1;
    buckets.delete(key);
    buckets.set(key, { tokens: allowed ? tokens - 1 : tokens, updatedAt: time });
    if (buckets.size > maxKeys) buckets.delete(buckets.keys().next().value!);

    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : Math.ceil((1 - tokens) / refillPerSecond),
    };
  }

  return { take };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
