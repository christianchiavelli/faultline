import {
  HOUR_MS,
  ROW_HEIGHT,
  buildTrace,
  burstAmplitude,
  burstDuration,
  type TraceEvent,
} from './trace';

const NOW = Date.UTC(2026, 8, 29, 6, 30);

function event(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return { id: 'us1', time: NOW - 2 * HOUR_MS, magnitude: 5, highlighted: true, ...overrides };
}

/** Absolute points of a path written as `M x y l dx dy dx dy…`. */
function points(path: string): { x: number; y: number }[] {
  const [x0 = 0, y0 = 0, ...deltas] = [...path.matchAll(/-?\d+/g)].map(Number);
  const result = [{ x: x0, y: y0 }];
  for (let i = 0; i + 1 < deltas.length; i += 2) {
    const last = result.at(-1)!;
    result.push({ x: last.x + deltas[i]!, y: last.y + deltas[i + 1]! });
  }
  return result;
}

const ys = (path: string) => points(path).map((point) => point.y);

describe('buildTrace', () => {
  it('draws one row per hour, the current hour last', () => {
    const rows = buildTrace([], NOW);

    expect(rows).toHaveLength(24);
    expect(rows.at(-1)!.start).toBe(Date.UTC(2026, 8, 29, 6));
    expect(rows[0]!.start).toBe(Date.UTC(2026, 8, 28, 7));
  });

  it('is deterministic, so the server and the browser draw the same paths', () => {
    expect(buildTrace([event()], NOW)).toEqual(buildTrace([event()], NOW));
  });

  it('keeps a quiet row within its noise band', () => {
    const quiet = buildTrace([], NOW)[5]!;
    const baseline = 5 * ROW_HEIGHT + ROW_HEIGHT / 2;

    for (const y of ys(quiet.ink)) expect(Math.abs(y - baseline)).toBeLessThanOrEqual(15);
  });

  it('lets a large burst reach into the neighbouring rows, up to the pen stop', () => {
    const rows = buildTrace([event({ magnitude: 7.5 })], NOW);
    const row = rows.find((candidate) => candidate.pen.length > 0)!;
    const index = rows.indexOf(row);
    const baseline = index * ROW_HEIGHT + ROW_HEIGHT / 2;
    const swing = Math.max(...ys(row.ink).map((y) => Math.abs(y - baseline)));

    expect(swing).toBeGreaterThan(ROW_HEIGHT);
    expect(swing).toBeLessThanOrEqual(2.2 * ROW_HEIGHT);
  });

  it('draws highlighted events in the pen as well as the ink', () => {
    const rows = buildTrace(
      [event({ highlighted: true }), event({ id: 'us2', time: NOW - HOUR_MS, highlighted: false })],
      NOW,
    );

    expect(rows.flatMap((row) => row.pen)).toHaveLength(1);
  });

  it('stops the current row at the present', () => {
    const current = buildTrace([], NOW).at(-1)!;

    // Half past the hour is 1,800 s, at ten units per second.
    expect(points(current.ink).at(-1)!.x).toBe(18_000);
  });
});

describe('burst scale', () => {
  it('grows ~3.2x per magnitude step, compressed from the real 10x', () => {
    expect(burstAmplitude(4) / burstAmplitude(3)).toBeCloseTo(Math.sqrt(10), 6);
  });

  it('lasts longer for larger ruptures, within bounds', () => {
    expect(burstDuration(6)).toBeGreaterThan(burstDuration(4));
    expect(burstDuration(0)).toBe(12_000);
    expect(burstDuration(9.5)).toBe(12 * 60_000);
  });
});
