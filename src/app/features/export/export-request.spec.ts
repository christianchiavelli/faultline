import { aQuake } from '@shared/testing/quake-fixture';
import {
  describeFile,
  describePeriod,
  estimateSize,
  initialForm,
  suggestionsFor,
  toAnchor,
  toQuery,
  type ExportForm,
} from './export-request';

const NOW = Date.UTC(2026, 8, 29, 19, 30, 15);
const DAY = 86_400_000;

const ende = toAnchor(
  aQuake({
    time: Date.UTC(2026, 7, 14, 21, 58, 21),
    magnitude: { value: 7.8, type: 'mww' },
    place: '66 km NNW of Ende, Indonesia',
    location: { latitude: -8.2, longitude: 121.5, depthKm: 10 },
  }),
);

describe('initialForm', () => {
  it('opens from the log on the last day, at the log’s own magnitude filter', () => {
    expect(initialForm(null, '4.5', NOW)).toMatchObject({
      period: 'day',
      magnitude: '4.5',
      area: 'world',
      custom: { from: '2026-08-30', to: '2026-09-29' },
    });
  });

  it('opens from an event on everything near it since it happened: its aftershocks', () => {
    expect(initialForm(ende, '2.5', NOW)).toMatchObject({
      period: 'since-event',
      magnitude: 'all',
      area: 'near',
      radiusKm: '100',
    });
    expect(ende.description).toBe('the M7.8 66 km NNW of Ende, Indonesia');
  });
});

describe('toQuery', () => {
  it('ends a relative period on the next whole minute, so it holds still between ticks', () => {
    const query = toQuery(initialForm(null, '2.5', NOW), null, NOW);

    expect(query.to).toBe(Date.UTC(2026, 8, 29, 19, 31));
    expect(query.to - query.from).toBe(DAY);
    expect(query).toMatchObject({ minMagnitude: 2.5, near: null, reviewedOnly: false });
  });

  it('reads a custom period as whole days, the last one included', () => {
    const form: ExportForm = {
      ...initialForm(null, 'all', NOW),
      period: 'custom',
      custom: { from: '2026-09-01', to: '2026-09-02' },
    };

    const query = toQuery(form, null, NOW);
    expect(query.from).toBe(Date.UTC(2026, 8, 1));
    expect(query.to).toBe(Date.UTC(2026, 8, 3));
    expect(query.minMagnitude).toBeNull();
  });

  it('draws the circle around the event, and only when asked to', () => {
    const near = toQuery(initialForm(ende, 'all', NOW), ende, NOW);
    const world = toQuery({ ...initialForm(ende, 'all', NOW), area: 'world' }, ende, NOW);

    expect(near.near).toEqual({ latitude: -8.2, longitude: 121.5, radiusKm: 100 });
    expect(near.from).toBe(ende.time);
    expect(world.near).toBeNull();
  });
});

describe('suggestionsFor', () => {
  it('offers a higher floor and a later start that should fit, for a long custom period', () => {
    const form: ExportForm = {
      ...initialForm(null, '4.5', NOW),
      period: 'custom',
      custom: { from: '2000-01-01', to: '2026-09-29' },
    };

    const suggestions = suggestionsFor(form, toQuery(form, null, NOW), 187_394, null);

    expect(suggestions.map((suggestion) => suggestion.label)).toEqual([
      'Only M6 and up',
      'From 1 Dec 2013',
    ]);
    expect(suggestions[1]!.change).toEqual({ custom: { from: '2013-12-01', to: '2026-09-29' } });
  });

  it('only offers a period that is shorter than the one chosen', () => {
    const week = { ...initialForm(null, 'all', NOW), period: 'week' as const };

    expect(suggestionsFor(week, toQuery(week, null, NOW), 150_000, null)).toEqual([
      { label: 'Only M2.5 and up', change: { magnitude: '2.5' } },
      { label: 'Only the last 24 hours', change: { period: 'day' } },
    ]);
  });
});

describe('describing the file', () => {
  it('puts size, place and magnitude in one line', () => {
    const query = toQuery(initialForm(ende, 'all', NOW), ende, NOW);

    expect(describeFile(query, 236, 'csv')).toBe(
      'About 61 kB, within 100 km of the epicentre, every magnitude',
    );
    expect(describePeriod(initialForm(ende, 'all', NOW), query)).toBe('14 Aug, 21:58 to now, UTC');
  });

  it('switches to megabytes where a file gets large', () => {
    expect(estimateSize(35, 'csv')).toBe('9 kB');
    expect(estimateSize(23_862, 'csv')).toBe('6.2 MB');
    expect(estimateSize(100_000, 'geojson')).toBe('55 MB');
  });
});
