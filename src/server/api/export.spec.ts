import type { ExportEvent } from '@shared/api/export';
import { UpstreamError } from '../http/upstream';
import type { SearchPage } from '../usgs/search';
import { prepareExport, type ExportDependencies, type ExportFile } from './export';

const EXPORT = '/api/quakes/export?from=2026-09-28T00:00:00Z&to=2026-09-29T00:00:00Z';
const url = (path: string) => new URL(path, 'http://localhost');
const signal = new AbortController().signal;

const event = (overrides: Partial<ExportEvent> = {}): ExportEvent => ({
  time: '2026-09-28T13:22:39.769Z',
  latitude: 19.16,
  longitude: -155.52,
  depth: -1.2,
  mag: 2.6,
  magType: 'ml',
  nst: 40,
  gap: 60,
  dmin: 0.02,
  rms: 0.11,
  net: 'hv',
  id: 'hv0001',
  updated: '2026-09-28T14:02:00.000Z',
  place: '6 km SW of Pāhala, Hawaii',
  type: 'earthquake',
  horizontalError: 0.3,
  depthError: 0.5,
  magError: 0.1,
  magNst: 12,
  status: 'reviewed',
  locationSource: 'hv',
  magSource: 'hv',
  url: 'https://earthquake.usgs.gov/earthquakes/eventpage/hv0001',
  ...overrides,
});

async function* pages(...list: SearchPage[]): AsyncGenerator<SearchPage> {
  yield* list;
}

function dependencies(overrides: Partial<ExportDependencies> = {}): ExportDependencies {
  return {
    count: vi.fn().mockResolvedValue(1),
    search: () => pages({ events: [event()], skipped: 0 }),
    ...overrides,
  };
}

/** Whether an export would be accepted now. One that is gives its place straight back. */
async function accepts(): Promise<boolean> {
  const reader = new AbortController();
  const result = await prepareExport(url(EXPORT), reader.signal, dependencies());
  reader.abort();
  return 'chunks' in result;
}

async function read(result: Awaited<ReturnType<typeof prepareExport>>): Promise<string> {
  let text = '';
  for await (const chunk of (result as ExportFile).chunks) text += chunk;
  return text;
}

describe('prepareExport', () => {
  it('writes a CSV that Excel opens as UTF-8, with the USGS column names and a link per row', async () => {
    const result = await prepareExport(url(EXPORT), signal, dependencies());

    expect(result).toMatchObject({
      fileName: 'faultline_2026-09-28_2026-09-28.csv',
      contentType: 'text/csv; charset=utf-8',
    });
    const [header, row] = (await read(result)).split('\r\n');
    expect(header).toMatch(/^\uFEFFtime,latitude,longitude,depth,mag,magType,/);
    expect(header).toMatch(/,url$/);
    expect(row).toBe(
      '2026-09-28T13:22:39.769Z,19.16,-155.52,-1.2,2.6,ml,40,60,0.02,0.11,hv,hv0001,2026-09-28T14:02:00.000Z,' +
        '"6 km SW of Pāhala, Hawaii",earthquake,0.3,0.5,0.1,12,reviewed,hv,hv,' +
        'https://earthquake.usgs.gov/earthquakes/eventpage/hv0001',
    );
  });

  it('writes GeoJSON in the USGS layout, with the totals it only knows at the end', async () => {
    const result = await prepareExport(
      url(`${EXPORT}&format=geojson`),
      signal,
      dependencies({
        search: () =>
          pages(
            { events: [event()], skipped: 1 },
            { events: [event({ id: 'hv0002', depth: null })], skipped: 0 },
          ),
      }),
    );

    const file = JSON.parse(await read(result));
    expect(
      file.features.map(
        (feature: { geometry: { coordinates: number[] } }) => feature.geometry.coordinates,
      ),
    ).toEqual([
      [-155.52, 19.16, -1.2],
      [-155.52, 19.16],
    ]);
    expect(file.features[0].properties).toMatchObject({
      mag: 2.6,
      place: '6 km SW of Pāhala, Hawaii',
    });
    expect(file.metadata).toMatchObject({ count: 2, skipped: 1 });
  });

  it('refuses a search too large for one file before writing anything', async () => {
    const search = vi.fn();
    const result = await prepareExport(
      url(EXPORT),
      signal,
      dependencies({ count: vi.fn().mockResolvedValue(187_394), search }),
    );

    expect(result).toMatchObject({ status: 422, body: { title: 'Too many events for one file' } });
    expect((result as { body: { detail: string } }).body.detail).toContain('187,394 events');
    expect(search).not.toHaveBeenCalled();
  });

  it('says what is wrong with a query, and never asks the USGS about it', async () => {
    const count = vi.fn();

    expect(
      await prepareExport(
        url('/api/quakes/export?from=1850-01-01T00:00:00Z&to=2026-09-29T00:00:00Z'),
        signal,
        dependencies({ count }),
      ),
    ).toMatchObject({
      status: 400,
      body: { detail: 'The catalogue starts in 1900.' },
    });
    expect(
      await prepareExport(url(`${EXPORT}&format=xlsx`), signal, dependencies({ count })),
    ).toMatchObject({ status: 400 });
    expect(count).not.toHaveBeenCalled();
  });

  it('reports a USGS that cannot count as a bad gateway', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await prepareExport(
      url(EXPORT),
      signal,
      dependencies({ count: vi.fn().mockRejectedValue(new UpstreamError('down')) }),
    );

    expect(result).toMatchObject({ status: 502 });
  });

  it('throws mid-file when the USGS fails mid-export, so the transport cuts the file off', async () => {
    async function* failing(): AsyncGenerator<SearchPage> {
      yield { events: [event()], skipped: 0 };
      throw new UpstreamError('USGS search answered 503', 503);
    }
    const result = await prepareExport(url(EXPORT), signal, dependencies({ search: failing }));

    await expect(read(result)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('turns the fifth export at once away until one finishes', async () => {
    const hold = () => ({
      async *[Symbol.asyncIterator]() {
        yield { events: [], skipped: 0 };
        await new Promise(() => undefined);
      },
    });
    const running = await Promise.all(
      Array.from({ length: 4 }, () =>
        prepareExport(url(EXPORT), signal, dependencies({ search: hold })),
      ),
    );
    const iterators = running.map((file) => (file as ExportFile).chunks[Symbol.asyncIterator]());
    await Promise.all(iterators.map((iterator) => iterator.next()));

    expect(await prepareExport(url(EXPORT), signal, dependencies())).toMatchObject({
      status: 503,
      headers: { 'retry-after': '10' },
    });

    await Promise.all(iterators.map((iterator) => iterator.return?.()));
    expect(await accepts()).toBe(true);
  });

  it('holds its place from the moment it is accepted, through the count', async () => {
    let answer: (count: number) => void = () => undefined;
    const counted = new Promise<number>((resolve) => (answer = resolve));
    const counting = Array.from({ length: 4 }, () =>
      prepareExport(url(EXPORT), signal, dependencies({ count: () => counted })),
    );

    expect(await prepareExport(url(EXPORT), signal, dependencies())).toMatchObject({
      status: 503,
    });

    // Refused after its count, too large for a file: each gives its place back.
    answer(187_394);
    expect(await Promise.all(counting)).toMatchObject(Array(4).fill({ status: 422 }));
    expect(await accepts()).toBe(true);
  });

  it('gives its place back when the reader leaves before the file starts', async () => {
    const readers = Array.from({ length: 4 }, () => new AbortController());
    for (const reader of readers) {
      expect(await prepareExport(url(EXPORT), reader.signal, dependencies())).toHaveProperty(
        'chunks',
      );
    }
    expect(await prepareExport(url(EXPORT), signal, dependencies())).toMatchObject({
      status: 503,
    });

    for (const reader of readers) reader.abort();

    expect(await accepts()).toBe(true);
  });
});
