import { createSwrCache } from './swr-cache';

function setup(freshForMs = 1_000, staleForMs = 10_000) {
  let now = 0;
  const cache = createSwrCache<string>({ freshForMs, staleForMs, now: () => now });
  return {
    cache,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('createSwrCache', () => {
  it('serves a fresh value without calling the loader again', async () => {
    const { cache, advance } = setup();
    const loader = vi.fn().mockResolvedValue('v1');

    await cache.get('k', loader);
    advance(500);

    expect(await cache.get('k', loader)).toEqual({ value: 'v1', stale: false });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('shares one upstream call between concurrent misses', async () => {
    const { cache } = setup();
    const loader = vi.fn().mockResolvedValue('v1');

    const results = await Promise.all([cache.get('k', loader), cache.get('k', loader)]);

    expect(results.map((hit) => hit.value)).toEqual(['v1', 'v1']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('serves the old value past freshness and refreshes behind it', async () => {
    const { cache, advance } = setup();
    await cache.get('k', () => Promise.resolve('v1'));
    advance(2_000);

    const refresh = vi.fn().mockResolvedValue('v2');
    expect(await cache.get('k', refresh)).toEqual({ value: 'v1', stale: false });
    await Promise.resolve();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect((await cache.get('k', refresh)).value).toBe('v2');
  });

  it('flags the old value stale once the upstream starts failing', async () => {
    const { cache, advance } = setup();
    await cache.get('k', () => Promise.resolve('v1'));
    advance(2_000);

    const failing = () => Promise.reject(new Error('down'));
    await cache.get('k', failing);
    await new Promise((resolve) => setTimeout(resolve));

    expect(await cache.get('k', failing)).toEqual({ value: 'v1', stale: true });
  });

  it('falls back to an expired value rather than failing outright', async () => {
    const { cache, advance } = setup();
    await cache.get('k', () => Promise.resolve('v1'));
    advance(60_000);

    expect(await cache.get('k', () => Promise.reject(new Error('down')))).toEqual({
      value: 'v1',
      stale: true,
    });
  });

  it('fails when there is nothing to fall back to', async () => {
    const { cache } = setup();
    await expect(cache.get('k', () => Promise.reject(new Error('down')))).rejects.toThrow('down');
  });

  it('evicts the oldest entry beyond its bound', async () => {
    let now = 0;
    const cache = createSwrCache<string>({
      freshForMs: 1_000,
      staleForMs: 0,
      maxEntries: 2,
      now: () => now,
    });
    const loader = vi.fn((value: string) => Promise.resolve(value));

    await cache.get('a', () => loader('a'));
    await cache.get('b', () => loader('b'));
    await cache.get('c', () => loader('c'));
    now += 10;
    await cache.get('a', () => loader('a again'));

    expect(loader).toHaveBeenLastCalledWith('a again');
  });
});
