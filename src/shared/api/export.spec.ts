import {
  exportDateRangeSchema,
  exportFileName,
  exportQuerySchema,
  exportSearchParams,
  type ExportQuery,
} from './export';

const parse = (params: Record<string, string>) =>
  exportQuerySchema.safeParse(Object.fromEntries(new URLSearchParams(params)));

const aftershocks: ExportQuery = {
  from: Date.UTC(2026, 7, 14, 21, 58),
  to: Date.UTC(2026, 8, 29, 19, 30),
  minMagnitude: 2.5,
  minDepthKm: null,
  maxDepthKm: 70,
  near: { latitude: -8.2, longitude: 121.5, radiusKm: 100 },
  review: 'reviewed',
  earthquakesOnly: true,
};

describe('exportQuerySchema', () => {
  it('reads back exactly what exportSearchParams writes', () => {
    const params = exportSearchParams(aftershocks);

    expect(params.toString()).toBe(
      'from=2026-08-14T21%3A58%3A00Z&to=2026-09-29T19%3A30%3A00Z&minmag=2.5&maxdepth=70&lat=-8.2&lon=121.5&radiuskm=100&review=reviewed&earthquakes=true',
    );
    expect(exportQuerySchema.parse(Object.fromEntries(params))).toEqual(aftershocks);
  });

  it('defaults to every magnitude, the whole world and every kind of event', () => {
    const result = parse({ from: '2026-09-28T00:00:00Z', to: '2026-09-29T00:00:00Z' });

    expect(result.data).toMatchObject({
      minMagnitude: null,
      minDepthKm: null,
      maxDepthKm: null,
      near: null,
      review: null,
      earthquakesOnly: false,
    });
  });

  it.each([
    [
      { from: '2026-09-29T00:00:00Z', to: '2026-09-28T00:00:00Z' },
      'The period must end after it starts.',
    ],
    [{ from: '1899-12-31T00:00:00Z', to: '2026-09-28T00:00:00Z' }, 'The catalogue starts in 1900.'],
    [{ from: 'yesterday', to: '2026-09-28T00:00:00Z' }, 'Expected an ISO time in UTC.'],
    [
      { from: '2026-09-28T00:00:00Z', to: '2026-09-29T00:00:00Z', minmag: '' },
      'Expected a number.',
    ],
    [
      { from: '2026-09-28T00:00:00Z', to: '2026-09-29T00:00:00Z', lat: '10', lon: '20' },
      'A circle needs lat, lon and radiuskm together.',
    ],
    [
      { from: '2026-09-28T00:00:00Z', to: '2026-09-29T00:00:00Z', mindepth: '300', maxdepth: '70' },
      'The depths must run from shallower to deeper.',
    ],
    [
      { from: '2026-09-28T00:00:00Z', to: '2026-09-29T00:00:00Z', review: 'maybe' },
      'Expected reviewed or automatic.',
    ],
    [
      { from: '2026-09-28T00:00:00Z', to: '2026-09-29T00:00:00Z', earthquakes: 'false' },
      'Expected true, or nothing.',
    ],
  ])('refuses %j', (params, message) => {
    const result = parse(params);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(message);
  });
});

describe('exportDateRangeSchema', () => {
  it('accepts a range of whole days, one day long included', () => {
    expect(exportDateRangeSchema.safeParse({ from: '2026-09-29', to: '2026-09-29' }).success).toBe(
      true,
    );
  });

  it('puts an inverted range on the end date, where the reader will fix it', () => {
    const result = exportDateRangeSchema.safeParse({ from: '2026-09-29', to: '2026-09-01' });

    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['to'], message: 'End on or after the start.' }),
    ]);
  });
});

describe('exportFileName', () => {
  it('names the period, the magnitude floor, the depth class, the review and the circle', () => {
    expect(exportFileName(aftershocks, 'csv')).toBe(
      'faultline_2026-08-14_2026-09-29_m2.5_shallow_reviewed_100km.csv',
    );
  });

  it('names a depth range only when it is one of the classes', () => {
    expect(
      exportFileName({ ...aftershocks, minDepthKm: 10, maxDepthKm: 70, review: null }, 'csv'),
    ).toBe('faultline_2026-08-14_2026-09-29_m2.5_100km.csv');
  });

  it('ends on the last day in the file, since the end of a period is exclusive', () => {
    const month = { ...aftershocks, from: Date.UTC(2026, 8, 1), to: Date.UTC(2026, 9, 1) };

    expect(
      exportFileName(
        { ...month, minMagnitude: null, maxDepthKm: null, review: null, near: null },
        'geojson',
      ),
    ).toBe('faultline_2026-09-01_2026-09-30.geojson');
  });
});
