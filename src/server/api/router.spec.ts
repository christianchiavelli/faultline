import type { RecentQuakesResponse } from '@shared/api/contracts';
import { aQuake } from '@shared/testing/quake-fixture';
import { UpstreamError } from '../http/upstream';
import { handleApiRequest, type Catalogue } from './router';

const feed: RecentQuakesResponse = {
  window: 'day',
  generatedAt: 1790660880000,
  stale: false,
  skipped: 0,
  quakes: [aQuake()],
};

function catalogue(overrides: Partial<Catalogue> = {}): Catalogue {
  return {
    recentQuakes: vi.fn().mockResolvedValue(feed),
    quakeDetail: vi.fn().mockResolvedValue({ quake: aQuake(), origin: null }),
    ...overrides,
  };
}

const url = (path: string) => new URL(path, 'http://localhost');

describe('handleApiRequest', () => {
  it('serves the day feed by default, cacheable and validated by an ETag', async () => {
    const result = await handleApiRequest('GET', url('/api/quakes/recent'), null, catalogue());

    expect(result.status).toBe(200);
    expect(result.body).toEqual(feed);
    expect(result.headers).toMatchObject({
      'cache-control': 'public, max-age=30, stale-while-revalidate=60',
      etag: 'W/"feed-day-1790660880000-f"',
    });
  });

  it('answers 304 without a body when the client already has this feed', async () => {
    const result = await handleApiRequest(
      'GET',
      url('/api/quakes/recent'),
      'W/"feed-day-1790660880000-f"',
      catalogue(),
    );

    expect(result.status).toBe(304);
    expect(result.body).toBeUndefined();
    expect(result.headers['content-type']).toBeUndefined();
  });

  it('rejects an unknown window with a problem document', async () => {
    const result = await handleApiRequest(
      'GET',
      url('/api/quakes/recent?window=year'),
      null,
      catalogue(),
    );

    expect(result.status).toBe(400);
    expect(result.headers['content-type']).toContain('application/problem+json');
    expect(result.body).toMatchObject({ status: 400, title: 'Unknown feed window' });
  });

  it('looks events up by a normalised id', async () => {
    const quakeDetail = vi.fn().mockResolvedValue({ quake: aQuake(), origin: null });
    await handleApiRequest('GET', url('/api/quakes/US7000TEST'), null, catalogue({ quakeDetail }));

    expect(quakeDetail).toHaveBeenCalledWith('us7000test');
  });

  it('tells a deleted event apart from one that never existed', async () => {
    const deleted = catalogue({ quakeDetail: vi.fn().mockResolvedValue({ gone: 'deleted' }) });
    const missing = catalogue({ quakeDetail: vi.fn().mockResolvedValue({ gone: 'not-found' }) });

    expect((await handleApiRequest('GET', url('/api/quakes/us1'), null, deleted)).status).toBe(410);
    expect((await handleApiRequest('GET', url('/api/quakes/us1'), null, missing)).status).toBe(404);
  });

  it('reports an upstream outage as a bad gateway, not as our own error', async () => {
    const down = catalogue({ recentQuakes: vi.fn().mockRejectedValue(new UpstreamError('down')) });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await handleApiRequest('GET', url('/api/quakes/recent'), null, down);

    expect(result.status).toBe(502);
    expect(result.headers['cache-control']).toBe('no-store');
  });

  it('only reads', async () => {
    const result = await handleApiRequest('POST', url('/api/quakes/recent'), null, catalogue());

    expect(result.status).toBe(405);
    expect(result.headers['allow']).toBe('GET, HEAD');
  });

  it('answers unknown paths with a 404 problem', async () => {
    expect((await handleApiRequest('GET', url('/api/nope'), null, catalogue())).status).toBe(404);
  });
});
