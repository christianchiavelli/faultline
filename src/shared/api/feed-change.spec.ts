import { byTimeDescending, type QuakeSummary } from '../domain/quake';
import { aQuake } from '../testing/quake-fixture';
import type { RecentQuakesResponse } from './contracts';
import { applyFeedChange, diffFeeds, feedVersion } from './feed-change';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 1, 12);

function aFeed(quakes: readonly QuakeSummary[], overrides: Partial<RecentQuakesResponse> = {}) {
  return {
    window: 'day',
    generatedAt: NOW,
    stale: false,
    skipped: 0,
    quakes: [...quakes].sort(byTimeDescending),
    ...overrides,
  } satisfies RecentQuakesResponse;
}

const tonga = aQuake({ id: 'us1tonga', time: NOW - 3 * HOUR, magnitude: null });
const geysers = aQuake({ id: 'nc1geysers', time: NOW - 5 * HOUR });
const oldest = aQuake({ id: 'ak1oldest', time: NOW - 23.9 * HOUR });

describe('feedVersion', () => {
  it('tells a feed gone stale from the same feed fresh', () => {
    const fresh = aFeed([tonga]);

    expect(feedVersion(fresh)).toBe(`${NOW}-f`);
    expect(feedVersion({ ...fresh, stale: true })).not.toBe(feedVersion(fresh));
  });
});

describe('diffFeeds', () => {
  const previous = aFeed([tonga, geysers, oldest]);
  // A minute on: an event just in, the Tonga one given its magnitude, the oldest aged out.
  const next = aFeed(
    [
      aQuake({ id: 'us1fresh', time: NOW - 60_000 }),
      { ...tonga, magnitude: { value: 4.6, type: 'mb' } },
      geysers,
    ],
    { generatedAt: NOW + 60_000 },
  );

  it('sends what is new or revised and the ids that left, never what stayed as it was', () => {
    const change = diffFeeds(previous, next);

    expect(change.upserted.map((quake) => quake.id)).toEqual(['us1fresh', 'us1tonga']);
    expect(change.removed).toEqual(['ak1oldest']);
    expect(change.generatedAt).toBe(NOW + 60_000);
  });

  it('brings the copy it was taken from up to date, exactly', () => {
    expect(applyFeedChange(previous, diffFeeds(previous, next))).toEqual(next);
  });

  it('carries a feed going stale with no events at all', () => {
    const stale = { ...previous, stale: true };

    const change = diffFeeds(previous, stale);

    expect(change).toMatchObject({ stale: true, upserted: [], removed: [] });
    expect(applyFeedChange(previous, change)).toEqual(stale);
  });

  it('lists events timed to the same millisecond as the BFF does, whatever order they came in', () => {
    const twin = aQuake({ id: 'us1twin', time: geysers.time });
    const before = aFeed([geysers]);
    // The USGS file has the new one first; a copy brought up to date has it last.
    const after = aFeed([twin, geysers]);

    expect(applyFeedChange(before, diffFeeds(before, after)).quakes).toEqual(after.quakes);
  });
});
