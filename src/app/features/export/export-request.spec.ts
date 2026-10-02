import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { aQuake } from '@shared/testing/quake-fixture';
import {
  DEFAULT_PRESET,
  describeFile,
  describeLeftOut,
  describePeriod,
  estimateSize,
  initialForm,
  suggestionsFor,
  toAnchor,
  toQuery,
  type ExportForm,
  type MagnitudeChoice,
} from './export-request';

// The build adds the data of the locale it is made in; a test in another one adds its own.
registerLocaleData(localePt);

const NOW = Date.UTC(2026, 8, 29, 19, 30, 15);
const DAY = 86_400_000;

/** The log's filters at a magnitude, and nothing else. */
const at = (magnitude: MagnitudeChoice) => ({ ...DEFAULT_PRESET, magnitude });

const ende = toAnchor(
  aQuake({
    time: Date.UTC(2026, 7, 14, 21, 58, 21),
    magnitude: { value: 7.8, type: 'mww' },
    place: '66 km NNW of Ende, Indonesia',
    location: { latitude: -8.2, longitude: 121.5, depthKm: 10 },
  }),
  'en-GB',
);

describe('initialForm', () => {
  it('opens from the log on the last day, at the log’s own magnitude filter', () => {
    expect(initialForm(null, at('4.5'), NOW)).toMatchObject({
      period: 'day',
      magnitude: '4.5',
      area: 'world',
      custom: { from: '2026-08-30', to: '2026-09-29' },
    });
  });

  it('opens from an event on everything near it since it happened: its aftershocks', () => {
    expect(initialForm(ende, at('2.5'), NOW)).toMatchObject({
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
    const query = toQuery(initialForm(null, at('2.5'), NOW), null, NOW);

    expect(query.to).toBe(Date.UTC(2026, 8, 29, 19, 31));
    expect(query.to - query.from).toBe(DAY);
    expect(query).toMatchObject({ minMagnitude: 2.5, near: null, review: null });
  });

  it('reads a custom period as whole days, the last one included', () => {
    const form: ExportForm = {
      ...initialForm(null, at('all'), NOW),
      period: 'custom',
      custom: { from: '2026-09-01', to: '2026-09-02' },
    };

    const query = toQuery(form, null, NOW);
    expect(query.from).toBe(Date.UTC(2026, 8, 1));
    expect(query.to).toBe(Date.UTC(2026, 8, 3));
    expect(query.minMagnitude).toBeNull();
  });

  it('draws the circle around the event, and only when asked to', () => {
    const near = toQuery(initialForm(ende, at('all'), NOW), ende, NOW);
    const world = toQuery({ ...initialForm(ende, at('all'), NOW), area: 'world' }, ende, NOW);

    expect(near.near).toEqual({ latitude: -8.2, longitude: 121.5, radiusKm: 100 });
    expect(near.from).toBe(ende.time);
    expect(world.near).toBeNull();
  });
});

describe('suggestionsFor', () => {
  it('offers a higher floor and a later start that should fit, for a long custom period', () => {
    const form: ExportForm = {
      ...initialForm(null, at('4.5'), NOW),
      period: 'custom',
      custom: { from: '2000-01-01', to: '2026-09-29' },
    };

    const suggestions = suggestionsFor(form, toQuery(form, null, NOW), 187_394, null, 'en-GB');

    expect(suggestions.map((suggestion) => suggestion.label)).toEqual([
      'Only M6 and up',
      'From 1 Dec 2013',
    ]);
    expect(suggestions[1]!.change).toEqual({ custom: { from: '2013-12-01', to: '2026-09-29' } });
  });

  it('only offers a period that is shorter than the one chosen', () => {
    const week = { ...initialForm(null, at('all'), NOW), period: 'week' as const };

    expect(suggestionsFor(week, toQuery(week, null, NOW), 150_000, null, 'en-GB')).toEqual([
      { label: 'Only M2.5 and up', change: { magnitude: '2.5' } },
      { label: 'Only the last 24 hours', change: { period: 'day' } },
    ]);
  });
});

describe('describing the file', () => {
  it('puts size, place and magnitude in one line', () => {
    const query = toQuery(initialForm(ende, at('all'), NOW), ende, NOW);

    expect(describeFile(query, 236, 'csv', 'en-GB')).toBe(
      'About 61 kB, within 100 km of the epicentre, every magnitude',
    );
    expect(describePeriod(initialForm(ende, at('all'), NOW), query, 'en-GB')).toBe(
      '14 Aug, 21:58 to now, UTC',
    );
  });

  it('switches to megabytes where a file gets large', () => {
    expect(estimateSize(35, 'csv', 'en-GB')).toBe('9 kB');
    expect(estimateSize(23_862, 'csv', 'en-GB')).toBe('6.2 MB');
    expect(estimateSize(100_000, 'geojson', 'en-GB')).toBe('55 MB');
  });

  it("writes its numbers and dates in the page's language", () => {
    const query = toQuery(initialForm(ende, at('all'), NOW), ende, NOW);

    expect(estimateSize(23_862, 'csv', 'pt-BR')).toBe('6,2 MB');
    expect(describePeriod(initialForm(ende, at('all'), NOW), query, 'pt-BR')).toMatch(
      /^14 ago\.?, 21:58 /,
    );
    expect(
      toAnchor(aQuake({ magnitude: { value: 7.8, type: 'mww' } }), 'pt-BR').description,
    ).toMatch(/^the M7,8 /);
  });
});

describe('carrying the log over', () => {
  it('opens on the log’s depth, review and kind, and asks the catalogue for them', () => {
    const form = initialForm(
      null,
      {
        magnitude: '4.5',
        depth: 'intermediate',
        review: 'automatic',
        kind: 'earthquake',
        leftOut: [],
      },
      NOW,
    );
    const query = toQuery(form, null, NOW);

    expect(form).toMatchObject({ magnitude: '4.5', depth: 'intermediate', review: 'automatic' });
    expect(query).toMatchObject({
      minMagnitude: 4.5,
      minDepthKm: 70,
      maxDepthKm: 300,
      review: 'automatic',
      earthquakesOnly: true,
    });
    expect(describeFile(query, 12, 'csv', 'en-GB')).toBe(
      'About 3 kB, worldwide, M4.5 and up, intermediate, automatic',
    );
  });

  it('names what it leaves in the log, and says nothing when it takes every filter', () => {
    expect(describeLeftOut([], 'en-GB')).toBeNull();
    expect(describeLeftOut(['region', 'search'], 'en-GB')).toBe(
      'Left in the log: the region and the place search. The USGS catalogue cannot select ' +
        'events that way, so the file holds more than the log shows.',
    );
    expect(describeLeftOut(['region', 'search', 'other-kinds'], 'en-GB')).toMatch(
      /^Left in the log: the region, the place search and other events alone\. /,
    );
  });
});
