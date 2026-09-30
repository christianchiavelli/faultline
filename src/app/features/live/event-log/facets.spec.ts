import type { Quake } from '@shared/domain/quake';
import { aQuake } from '@shared/testing/quake-fixture';
import { describeFilters, facetsOf, matches, sortEntries, toEntries, type Facet } from './facets';
import { DEFAULT_LOG_QUERY, type LogQuery } from './log-query';

const at = (latitude: number, depthKm: number | null) => ({ latitude, longitude: 0, depthKm });

const day: Quake[] = [
  aQuake({ id: 'a1', place: '12 km NW of Anchorage, Alaska', location: at(61, 35) }),
  aQuake({ id: 'a2', place: '8 km S of Willow, Alaska', location: at(61, 120) }),
  aQuake({ id: 'a3', place: '5 km E of Talkeetna, Alaska', review: 'automatic' }),
  aQuake({ id: 'c1', place: '6 km NW of The Geysers, CA', magnitude: { value: 1.1, type: 'md' } }),
  aQuake({ id: 'c2', place: '3 km W of Cobb, CA', kind: 'quarry blast' }),
  aQuake({ id: 't1', place: '120 km NE of Neiafu, Tonga', location: at(-18, 410) }),
  aQuake({ id: 'j1', place: '30 km E of Hualien City, Taiwan', location: at(24, null) }),
  aQuake({ id: 'f1', place: 'south of the Fiji Islands' }),
];

const entries = toEntries(day);
const facet = (facets: readonly Facet[], key: string) => facets.find((f) => f.key === key)!;
const counts = (f: Facet) => Object.fromEntries(f.options.map((o) => [o.label, o.count]));
const ids = (query: LogQuery, except?: Parameters<typeof matches>[2]) =>
  entries.filter((entry) => matches(entry, query, except)).map((entry) => entry.quake.id);

describe('toEntries', () => {
  it('reads the region and the depth class of each event once', () => {
    const read = entries.map(({ quake, region, regionSlug, depth }) => ({
      id: quake.id,
      region,
      regionSlug,
      depth,
    }));

    expect(read).toContainEqual({
      id: 'a2',
      region: 'Alaska',
      regionSlug: 'alaska',
      depth: 'intermediate',
    });
    expect(read).toContainEqual({
      id: 'c1',
      region: 'California',
      regionSlug: 'california',
      depth: 'shallow',
    });
    expect(read).toContainEqual({ id: 't1', region: 'Tonga', regionSlug: 'tonga', depth: 'deep' });
    expect(read).toContainEqual({ id: 'j1', region: 'Taiwan', regionSlug: 'taiwan', depth: null });
    expect(read).toContainEqual({
      id: 'f1',
      region: 'South of the Fiji Islands',
      regionSlug: 'south-of-the-fiji-islands',
      depth: 'shallow',
    });
  });
});

describe('matches', () => {
  it('applies every filter, or every filter but one', () => {
    const query: LogQuery = { ...DEFAULT_LOG_QUERY, region: 'alaska', depth: 'intermediate' };

    expect(ids(query)).toEqual(['a2']);
    expect(ids(query, 'depth')).toEqual(['a1', 'a2', 'a3']);
  });

  it('tells earthquakes from other events', () => {
    expect(ids({ ...DEFAULT_LOG_QUERY, kind: 'other' })).toEqual(['c2']);
    expect(ids({ ...DEFAULT_LOG_QUERY, magnitude: 'any', kind: 'earthquake' })).not.toContain('c2');
  });
});

describe('matches, searching', () => {
  it('finds every word of a search in the place or its region, accents aside', () => {
    expect(ids({ ...DEFAULT_LOG_QUERY, magnitude: 'any', search: 'california' })).toEqual([
      'c1',
      'c2',
    ]);
    expect(ids({ ...DEFAULT_LOG_QUERY, search: 'ALASKA willow' })).toEqual(['a2']);
    expect(ids({ ...DEFAULT_LOG_QUERY, search: 'hualien taipei' })).toEqual([]);
  });

  it('counts the options of every facet within the search', () => {
    const facets = facetsOf(entries, { ...DEFAULT_LOG_QUERY, search: 'alaska' });

    expect(facet(facets, 'region').options.map((o) => [o.label, o.count])).toEqual([
      ['Anywhere', 3],
      ['Alaska', 3],
    ]);
  });
});

describe('facetsOf', () => {
  it('counts each option with the other filters kept', () => {
    const facets = facetsOf(entries, { ...DEFAULT_LOG_QUERY, region: 'alaska' });

    expect(counts(facet(facets, 'depth'))).toEqual({
      Any: 3,
      Shallow: 2,
      Intermediate: 1,
      Deep: 0,
    });
    expect(counts(facet(facets, 'review'))).toEqual({ Any: 3, Reviewed: 2, Automatic: 1 });
    // The region's own options are counted as if no region were chosen.
    expect(facet(facets, 'region').options[0]).toMatchObject({ label: 'Anywhere', count: 7 });
  });

  it('links each option to its view, marking the one in force', () => {
    const facets = facetsOf(entries, { ...DEFAULT_LOG_QUERY, region: 'alaska' });
    const region = facet(facets, 'region');

    expect(region.options.find((o) => o.label === 'Alaska')).toMatchObject({
      current: true,
      params: { region: 'alaska' },
    });
    expect(region.all?.find((o) => o.label === 'Tonga')).toMatchObject({
      current: false,
      params: { region: 'tonga' },
    });
    expect(facet(facets, 'magnitude').options[0]?.params).toEqual({ mag: 'any', region: 'alaska' });
  });

  it('shows the busiest regions, keeps the chosen one in view, and has the rest a link away', () => {
    const region = facet(facetsOf(entries, { ...DEFAULT_LOG_QUERY, region: 'tonga' }), 'region');

    // Ties in alphabetical order, so the list holds still between deliveries.
    expect(region.options.map((o) => o.label)).toEqual([
      'Anywhere',
      'Alaska',
      'California',
      'South of the Fiji Islands',
      'Taiwan',
      'Tonga',
    ]);
    expect(region.all).toHaveLength(5);
  });

  it('keeps a region the address names after its events are gone', () => {
    const region = facet(
      facetsOf(entries, { ...DEFAULT_LOG_QUERY, region: 'puerto-rico' }),
      'region',
    );

    expect(region.options.at(-1)).toMatchObject({ label: 'Puerto rico', count: 0, current: true });
  });
});

describe('describeFilters', () => {
  it('writes the filters in force as one line', () => {
    expect(describeFilters(facetsOf(entries, DEFAULT_LOG_QUERY))).toBe('M2.5 and up');
    expect(
      describeFilters(
        facetsOf(entries, {
          ...DEFAULT_LOG_QUERY,
          magnitude: 'any',
          region: 'alaska',
          depth: 'shallow',
          review: 'reviewed',
        }),
      ),
    ).toBe('any magnitude · Alaska · shallow · reviewed');
    expect(describeFilters(facetsOf(entries, DEFAULT_LOG_QUERY), 'willow')).toBe(
      'M2.5 and up · “willow”',
    );
  });
});

describe('sortEntries', () => {
  const order = (by: Parameters<typeof sortEntries>[1]) =>
    sortEntries(
      toEntries([
        aQuake({ id: 'old', time: 1, magnitude: { value: 3, type: 'ml' }, location: at(0, 10) }),
        aQuake({ id: 'new', time: 3, magnitude: { value: 3, type: 'ml' }, location: at(0, null) }),
        aQuake({ id: 'big', time: 2, magnitude: { value: 6, type: 'mww' }, location: at(0, 500) }),
        aQuake({ id: 'none', time: 4, magnitude: null, location: at(0, 35) }),
      ]),
      by,
    ).map((entry) => entry.quake.id);

  it('puts the newest, the largest or the deepest first', () => {
    expect(order('newest')).toEqual(['none', 'new', 'big', 'old']);
    expect(order('largest')[0]).toBe('big');
    expect(order('deepest')[0]).toBe('big');
  });

  it('puts events without the value last, and the newest first among equals', () => {
    expect(order('largest')).toEqual(['big', 'new', 'old', 'none']);
    expect(order('deepest')).toEqual(['big', 'none', 'old', 'new']);
  });
});
