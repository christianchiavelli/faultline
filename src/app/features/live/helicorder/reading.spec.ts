import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { aQuake } from '@shared/testing/quake-fixture';
import { describeEvent, eventAt, place } from './reading';
import { HOUR_MS, type TraceEvent } from './trace';

// The build adds the data of the locale it is made in; a test in another one adds its own.
registerLocaleData(localePt);

const FIRST = Date.UTC(2026, 8, 28, 7);
const NOW = Date.UTC(2026, 8, 29, 6, 30);
const HOURS = 24;

/** Halfway along the third line, too small to draw anything but a flicker. */
function event(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return { id: 'us1', time: FIRST + 2.5 * HOUR_MS, magnitude: 2, highlighted: false, ...overrides };
}

/** A point on a 1,200 × 480 paper: 20 px a line, and 3 s of the hour to a pixel. */
function probe(x: number, y: number, reach = 24) {
  return { x: x / 1200, y: y / 480, width: 1200, height: 480, reach };
}

describe('place', () => {
  it('sets each event at its origin, oldest first', () => {
    const placed = place(
      [event({ id: 'late', time: FIRST + 5.25 * HOUR_MS }), event({ id: 'early' })],
      FIRST,
      NOW,
      HOURS,
    );

    expect(placed.map((item) => item.id)).toEqual(['early', 'late']);
    expect(placed[1]).toMatchObject({ row: 5, at: 0.25 });
  });

  it('leaves out what the drum does not show: before its first line, or not drawn yet', () => {
    const placed = place(
      [event({ id: 'old', time: FIRST - 1 }), event({ id: 'next', time: NOW + 1 })],
      FIRST,
      NOW,
      HOURS,
    );

    expect(placed).toEqual([]);
  });

  it('carries a burst that outlasts its hour on to the next line', () => {
    // An M7.5 shakes for the full twelve minutes; this one starts two minutes before the hour.
    const [placed] = place(
      [event({ time: FIRST + 3 * HOUR_MS - 2 * 60_000, magnitude: 7.5 })],
      FIRST,
      NOW,
      HOURS,
    );

    expect(placed!.spans).toEqual([
      { row: 2, from: expect.closeTo(58 / 60, 9), to: 1 },
      { row: 3, from: 0, to: expect.closeTo(10 / 60, 9) },
    ]);
  });
});

describe('eventAt', () => {
  // The origin is at 600, 50: halfway across, in the middle of the third line.
  const quiet = place([event({ id: 'quiet' })], FIRST, NOW, HOURS);

  it('finds an event a few pixels off its origin', () => {
    expect(eventAt(quiet, probe(603, 47), HOURS)).toBe('quiet');
  });

  it('finds nothing past its reach, which is longer for a finger', () => {
    expect(eventAt(quiet, probe(640, 50), HOURS)).toBeNull();
    expect(eventAt(quiet, probe(640, 50, 40), HOURS)).toBe('quiet');
  });

  it('finds a large event anywhere along its burst', () => {
    // An M6 shakes for over five minutes: about 100 px at this width.
    const big = place([event({ id: 'big', magnitude: 6 })], FIRST, NOW, HOURS);

    expect(eventAt(big, probe(690, 50), HOURS)).toBe('big');
  });

  it('inside two bursts, picks the one that starts nearest the point', () => {
    const placed = place(
      [
        event({ id: 'big', magnitude: 6 }),
        event({ id: 'aftershock', time: event().time + 60_000 }),
      ],
      FIRST,
      NOW,
      HOURS,
    );

    // The aftershock starts a minute later, 20 px to the right, inside the larger burst.
    expect(eventAt(placed, probe(621, 50), HOURS)).toBe('aftershock');
    expect(eventAt(placed, probe(680, 50), HOURS)).toBe('big');
  });

  it('prefers the line pointed at over the one above it', () => {
    const placed = place(
      [event({ id: 'above' }), event({ id: 'below', time: event().time + HOUR_MS })],
      FIRST,
      NOW,
      HOURS,
    );

    expect(eventAt(placed, probe(600, 68), HOURS)).toBe('below');
  });
});

describe('describeEvent', () => {
  it('gives the card and the screen reader the same facts', () => {
    const description = describeEvent(
      aQuake({
        time: Date.UTC(2026, 8, 29, 14, 36, 20),
        magnitude: { value: 2, type: 'ml' },
        place: '3 km NW of Petersville, Alaska',
        review: 'automatic',
        location: { latitude: 62.4, longitude: -150.8, depthKm: 80.7 },
      }),
      'en-GB',
    );

    expect(description).toMatchObject({
      magnitude: { value: '2.0', scale: { code: 'ML' } },
      place: '3 km NW of Petersville, Alaska',
      depth: { km: '80.7', above: false },
      reviewed: false,
      kind: null,
    });
    expect(description.text).toBe(
      'M2.0 ML, 3 km NW of Petersville, Alaska, 14:36:20 UTC, 80.7 km deep, automatic',
    );
  });

  it('says what is missing or unusual instead of hiding it', () => {
    const description = describeEvent(
      aQuake({
        magnitude: null,
        place: null,
        kind: 'quarry blast',
        location: { latitude: 19.2, longitude: -155.5, depthKm: -1.2 },
      }),
      'en-GB',
    );

    expect(description).toMatchObject({
      magnitude: null,
      place: 'Location not described',
      depth: { km: '1.2', above: true },
      kind: 'quarry blast',
    });
    expect(description.text).toMatch(/^No magnitude yet, .*1\.2 km above sea level, quarry blast/);
  });

  it('writes a magnitude below zero with a real minus sign', () => {
    expect(
      describeEvent(aQuake({ magnitude: { value: -0.4, type: 'md' } }), 'en-GB').magnitude?.value,
    ).toBe('−0.4');
  });

  it("sets its numbers in the page's language", () => {
    const description = describeEvent(
      aQuake({
        magnitude: { value: 5.1, type: 'mww' },
        location: { latitude: 62.4, longitude: -150.8, depthKm: 10 },
      }),
      'pt-BR',
    );

    expect(description).toMatchObject({
      magnitude: { value: '5,1' },
      depth: { km: '10,0', above: false },
    });
    expect(description.text).toMatch(/^M5,1 Mww, /);
  });
});
