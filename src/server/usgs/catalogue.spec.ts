import { UpstreamError } from '../http/upstream';
import { quakeDetail, recentQuakes } from './catalogue';

/** A record shaped after one from the `all_day` feed. */
const feature = (id: string, time: number, properties: object = {}) => ({
  type: 'Feature',
  id,
  properties: {
    mag: 1.31,
    place: '2 km NNW of The Geysers, CA',
    time,
    updated: time + 60_000,
    url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    felt: null,
    alert: null,
    status: 'automatic',
    sig: 26,
    net: 'nc',
    magType: 'md',
    type: 'earthquake',
    ...properties,
  },
  geometry: { type: 'Point', coordinates: [-122.7626, 38.7938, 0.75] },
});

/** Answers every USGS call with `answer`, and notes what was asked. */
function usgs(answer: () => Response) {
  const fetchFn = vi.fn(() => Promise.resolve(answer()));
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
}

describe('recentQuakes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the feed newest first, and drops a malformed record rather than the feed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    usgs(() =>
      Response.json({
        type: 'FeatureCollection',
        metadata: { generated: 1_790_660_700_000, count: 3 },
        features: [
          feature('nc1older', 1_790_660_000_000),
          { type: 'Feature', id: 'broken', properties: {} },
          feature('nc2newer', 1_790_660_500_000),
        ],
      }),
    );

    const feed = await recentQuakes('hour');

    expect(feed).toMatchObject({ window: 'hour', stale: false, skipped: 1 });
    expect(feed.quakes.map((quake) => quake.id)).toEqual(['nc2newer', 'nc1older']);
    expect(console.warn).toHaveBeenCalledWith('[usgs] hour feed: skipped 1 malformed records');
  });

  it('puts a feed in a shape it cannot read down to the USGS', async () => {
    usgs(() => Response.json({ type: 'FeatureCollection', features: 'none' }));

    await expect(recentQuakes('week')).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe('quakeDetail', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads an event and the quality of its solution from its preferred origin', async () => {
    usgs(() =>
      Response.json(
        feature('us1found', 1_790_660_000_000, {
          products: {
            origin: [
              { preferredWeight: 1, properties: { 'horizontal-error': '12' } },
              {
                preferredWeight: 156,
                properties: {
                  'horizontal-error': '9.29',
                  'vertical-error': '1.733',
                  'num-stations-used': '81',
                  'azimuthal-gap': '60',
                  'depth-type': 'operator assigned',
                },
              },
            ],
          },
        }),
      ),
    );

    expect(await quakeDetail('us1found')).toMatchObject({
      quake: { id: 'us1found', magnitude: { value: 1.31, type: 'md' } },
      origin: {
        horizontalErrorKm: 9.29,
        depthErrorKm: 1.733,
        stationsUsed: 81,
        azimuthalGapDeg: 60,
        depthType: 'operator assigned',
      },
    });
  });

  it.each([
    [404, 'not-found'],
    [204, 'not-found'],
    [409, 'deleted'],
  ])('reads a %i from the event service as an event %s', async (status, gone) => {
    usgs(() => new Response(null, { status }));

    expect(await quakeDetail(`us1gone${status}`)).toEqual({ gone });
  });

  it('asks the event service for the id as given, escaped', async () => {
    const fetchFn = usgs(() => new Response(null, { status: 404 }));

    await quakeDetail('us 1/odd');

    const url = new URL(String((fetchFn.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/fdsnws/event/1/query');
    expect(url.searchParams.get('eventid')).toBe('us 1/odd');
  });
});
