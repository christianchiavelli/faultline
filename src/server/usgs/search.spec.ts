import type { ExportQuery } from '@shared/api/export';
import { UpstreamError } from '../http/upstream';
import { CSV_COLUMNS } from './schema';
import { countEvents, searchEvents } from './search';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 8, 28);

interface FakeEvent {
  readonly id: string;
  readonly at: number;
  readonly latitude?: string;
}

const query: ExportQuery = {
  from: T0,
  to: T0 + 24 * HOUR,
  minMagnitude: null,
  near: null,
  minDepthKm: null,
  maxDepthKm: null,
  review: null,
  earthquakesOnly: false,
};

function row(event: FakeEvent): string {
  const values: Record<string, string> = {
    time: new Date(event.at).toISOString(),
    latitude: event.latitude ?? '-24.3',
    longitude: '-178.1',
    depth: '560.2',
    mag: '4.6',
    magType: 'mb',
    net: 'us',
    id: event.id,
    updated: new Date(event.at + HOUR).toISOString(),
    place: 'south of the Fiji Islands',
    type: 'earthquake',
    status: 'reviewed',
    locationSource: 'us',
    magSource: 'us',
  };
  return CSV_COLUMNS.map((column) => values[column] ?? '').join(',');
}

/**
 * A small FDSN: answers `format=csv` searches from a list of events, honouring
 * `starttime` (inclusive), `orderby=time-asc` and `limit`, like the real one.
 */
function fakeUsgs(events: readonly FakeEvent[]) {
  const requests: URL[] = [];
  const fetchFn = vi.fn((input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url);
    const start = Date.parse(url.searchParams.get('starttime')!);
    const limit = Number(url.searchParams.get('limit'));
    const page = [...events]
      .sort((a, b) => a.at - b.at)
      .filter((event) => event.at >= start)
      .slice(0, limit);
    const body = [CSV_COLUMNS.join(','), ...page.map(row)].join('\n');
    return Promise.resolve(new Response(body, { status: 200 }));
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, requests };
}

const free = () => Promise.resolve();

async function collect(pages: AsyncIterable<{ events: readonly { id: string }[] }>) {
  const ids: string[] = [];
  for await (const page of pages) ids.push(...page.events.map((event) => event.id));
  return ids;
}

describe('searchEvents', () => {
  it('pages by time, so an instant split across a seam is neither repeated nor lost', async () => {
    const events = [
      { id: 'a', at: T0 + 1 * HOUR },
      { id: 'b', at: T0 + 2 * HOUR },
      { id: 'c1', at: T0 + 3 * HOUR },
      { id: 'c2', at: T0 + 3 * HOUR },
      { id: 'd', at: T0 + 4 * HOUR },
      { id: 'e', at: T0 + 5 * HOUR },
      { id: 'f', at: T0 + 6 * HOUR },
    ];
    const { fetchFn, requests } = fakeUsgs(events);

    const ids = await collect(
      searchEvents(query, {
        signal: new AbortController().signal,
        pageSize: 3,
        fetchFn,
        spend: free,
      }),
    );

    expect(ids).toEqual(['a', 'b', 'c1', 'c2', 'd', 'e', 'f']);
    expect(requests.map((url) => url.searchParams.get('starttime'))).toEqual([
      '2026-09-28T00:00:00.000Z',
      '2026-09-28T03:00:00.000Z',
      '2026-09-28T04:00:00.000Z',
      '2026-09-28T06:00:00.000Z',
    ]);
    expect(requests[0]!.searchParams.get('orderby')).toBe('time-asc');
    expect(requests[0]!.searchParams.get('endtime')).toBe('2026-09-28T23:59:59.999Z');
  });

  it('drops a row that fails validation and says how many it dropped', async () => {
    const { fetchFn } = fakeUsgs([
      { id: 'a', at: T0 + HOUR },
      { id: 'bad', at: T0 + 2 * HOUR, latitude: 'north' },
    ]);
    const pages = [];
    for await (const page of searchEvents(query, {
      signal: new AbortController().signal,
      fetchFn,
      spend: free,
    }))
      pages.push(page);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.events.map((event) => event.id)).toEqual(['a']);
    expect(pages[0]!.events[0]!.url).toBe('https://earthquake.usgs.gov/earthquakes/eventpage/a');
    expect(pages[0]!.skipped).toBe(1);
  });

  it('asks for no more pages once the reader has gone', async () => {
    const events = Array.from({ length: 5 }, (_, index) => ({
      id: `e${index}`,
      at: T0 + index * HOUR,
    }));
    const { fetchFn } = fakeUsgs(events);
    const controller = new AbortController();

    const pages = searchEvents(query, {
      signal: controller.signal,
      pageSize: 2,
      fetchFn,
      spend: free,
    });
    await pages.next();
    controller.abort();

    await expect(pages.next()).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('refuses to loop when a whole page shares one instant', async () => {
    const { fetchFn } = fakeUsgs([
      { id: 'x', at: T0 },
      { id: 'y', at: T0 },
    ]);

    await expect(
      collect(
        searchEvents(query, {
          signal: new AbortController().signal,
          pageSize: 2,
          fetchFn,
          spend: free,
        }),
      ),
    ).rejects.toBeInstanceOf(UpstreamError);
  });

  it('fails loudly when the USGS stops sending a column the export needs', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('time,latitude\n', { status: 200 }));

    await expect(
      collect(searchEvents(query, { signal: new AbortController().signal, fetchFn, spend: free })),
    ).rejects.toThrow(/no longer sends longitude/);
  });
});

describe('countEvents', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the USGS in its own terms, once per query', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(Response.json({ count: 236, maxAllowed: 20_000 })));
    vi.stubGlobal('fetch', fetchFn);
    const aftershocks: ExportQuery = {
      ...query,
      minMagnitude: 2.5,
      minDepthKm: 70,
      maxDepthKm: 300,
      near: { latitude: -8.2, longitude: 121.5, radiusKm: 100 },
      review: 'automatic',
      earthquakesOnly: true,
    };

    expect(await countEvents(aftershocks)).toBe(236);
    expect(await countEvents(aftershocks)).toBe(236);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = new URL(String((fetchFn.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/fdsnws/event/1/count');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      minmagnitude: '2.5',
      latitude: '-8.2',
      longitude: '121.5',
      maxradiuskm: '100',
      mindepth: '70',
      maxdepth: '300',
      reviewstatus: 'automatic',
      eventtype: 'earthquake',
    });
  });
});
