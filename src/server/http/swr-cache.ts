export interface SwrCacheOptions {
  /** Served as is, no upstream call. */
  readonly freshForMs: number;
  /** After fresh: served immediately while one background refresh runs. */
  readonly staleForMs: number;
  /** Oldest entries are evicted beyond this. Keys such as event ids are unbounded. */
  readonly maxEntries?: number;
  readonly now?: () => number;
  readonly onBackgroundError?: (key: string, error: unknown) => void;
}

export interface CacheHit<T> {
  readonly value: T;
  /**
   * The upstream is failing and this is the last good copy. Merely being past
   * `freshForMs` is not stale in this sense: that is the normal
   * stale-while-revalidate path and says nothing about the upstream.
   */
  readonly stale: boolean;
}

interface Entry<T> {
  readonly value: T;
  readonly storedAt: number;
  /** The last refresh attempt failed. Cleared by the next success. */
  readonly failing: boolean;
}

/**
 * Stale-while-revalidate with single-flight loading.
 *
 * - Concurrent misses for one key share one upstream request. A burst of
 *   renders after a deploy costs the USGS one call, not one per visitor.
 * - Past freshness, the old value is served instantly and refreshed behind it.
 * - Past the stale window, the caller waits for the refresh; if it fails, the
 *   old value is served anyway, flagged `stale`. An hour-old feed labelled as
 *   such is more useful than an error page, and the payload says how old it is.
 */
export function createSwrCache<T>(options: SwrCacheOptions) {
  const { freshForMs, staleForMs, maxEntries = 100, now = Date.now, onBackgroundError } = options;
  const entries = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();

  function store(key: string, entry: Entry<T>): void {
    entries.delete(key);
    entries.set(key, entry);
    if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
  }

  function markFailing(key: string): void {
    const entry = entries.get(key);
    if (entry && !entry.failing) entries.set(key, { ...entry, failing: true });
  }

  function load(key: string, loader: () => Promise<T>): Promise<T> {
    const pending = inflight.get(key);
    if (pending) return pending;

    const promise = loader()
      .then((value) => {
        store(key, { value, storedAt: now(), failing: false });
        return value;
      })
      .catch((error: unknown) => {
        markFailing(key);
        throw error;
      })
      .finally(() => inflight.delete(key));

    inflight.set(key, promise);
    return promise;
  }

  async function get(key: string, loader: () => Promise<T>): Promise<CacheHit<T>> {
    const entry = entries.get(key);
    const age = entry ? now() - entry.storedAt : Infinity;

    if (entry && age < freshForMs) return { value: entry.value, stale: false };

    if (entry && age < freshForMs + staleForMs) {
      load(key, loader).catch((error: unknown) => onBackgroundError?.(key, error));
      return { value: entry.value, stale: entry.failing };
    }

    try {
      return { value: await load(key, loader), stale: false };
    } catch (error) {
      if (entry) return { value: entry.value, stale: true };
      throw error;
    }
  }

  return { get };
}
