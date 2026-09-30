import {
  DEFAULT_LOG_QUERY,
  clearFilters,
  isFiltered,
  logParams,
  parseLogQuery,
  type LogQuery,
} from './log-query';

describe('parseLogQuery', () => {
  it('reads an empty address as the default view', () => {
    expect(parseLogQuery({})).toEqual(DEFAULT_LOG_QUERY);
  });

  it('reads every filter and the unfolded log', () => {
    expect(
      parseLogQuery({
        mag: 'any',
        region: 'alaska',
        depth: 'shallow',
        review: 'reviewed',
        kind: 'earthquake',
        q: 'anchorage',
        rows: 'all',
      }),
    ).toEqual({
      magnitude: 'any',
      region: 'alaska',
      depth: 'shallow',
      review: 'reviewed',
      kind: 'earthquake',
      search: 'anchorage',
      unfolded: true,
    });
  });

  it('reads a value it does not know as the default, rather than failing the page', () => {
    expect(
      parseLogQuery({
        mag: '7',
        region: '../etc',
        depth: 'mantle',
        review: 'maybe',
        kind: 'blast',
        rows: 'some',
      }),
    ).toEqual(DEFAULT_LOG_QUERY);
  });

  it('keeps a search as typed, its spaces tidied and its length capped', () => {
    expect(parseLogQuery({ q: '  the   geysers ' }).search).toBe('the geysers');
    expect(parseLogQuery({ q: 'a'.repeat(200) }).search).toHaveLength(80);
  });

  it('reads a region the way the app writes it, whatever the case', () => {
    expect(parseLogQuery({ region: 'US-Virgin-Islands' }).region).toBe('us-virgin-islands');
    expect(parseLogQuery({ region: 'x'.repeat(65) }).region).toBeNull();
  });
});

describe('logParams', () => {
  it('leaves defaults out of the address', () => {
    expect(logParams(DEFAULT_LOG_QUERY)).toEqual({});
  });

  it('writes what differs from the default in one order, and reads back as the same view', () => {
    const query: LogQuery = {
      magnitude: '4.5',
      region: 'indonesia',
      depth: 'intermediate',
      review: 'automatic',
      kind: 'other',
      search: 'cobb',
      unfolded: true,
    };

    expect(Object.entries(logParams(query))).toEqual([
      ['mag', '4.5'],
      ['region', 'indonesia'],
      ['depth', 'intermediate'],
      ['review', 'automatic'],
      ['kind', 'other'],
      ['q', 'cobb'],
      ['rows', 'all'],
    ]);
    expect(parseLogQuery(logParams(query))).toEqual(query);
  });
});

describe('clearFilters', () => {
  it('puts every filter and the search back, and keeps the log unfolded', () => {
    const query: LogQuery = {
      ...DEFAULT_LOG_QUERY,
      region: 'alaska',
      search: 'willow',
      unfolded: true,
    };

    expect(isFiltered(query)).toBe(true);
    expect(clearFilters(query)).toEqual({ ...DEFAULT_LOG_QUERY, unfolded: true });
    expect(isFiltered(clearFilters(query))).toBe(false);
  });
});
