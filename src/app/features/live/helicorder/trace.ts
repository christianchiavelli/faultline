/**
 * Draws a synthetic helicorder: the drum seismograph record that wraps a day of
 * ground motion into one line per hour, oldest at the top.
 *
 * It is not a recording, and the page says so. No single station hears the
 * whole planet and the feed carries no waveforms. Each event becomes a burst
 * placed at its origin time, sized from its magnitude, over a faint background
 * so the line reads as ink rather than a ruler.
 *
 * Pure and deterministic: the server renders the same paths the browser
 * hydrates, and a row's path only changes when its events or the clock do.
 */

export interface TraceEvent {
  readonly id: string;
  readonly time: number;
  readonly magnitude: number | null;
  /** Drawn in the pen colour on top of the ink. */
  readonly highlighted: boolean;
}

export interface TraceRow {
  /** Start of the hour, epoch milliseconds. */
  readonly start: number;
  readonly ink: string;
  readonly pen: readonly string[];
}

export const HOUR_MS = 3_600_000;

/** One unit per tenth of a second: a row is 36,000 units wide, and every coordinate an integer. */
const UNITS_PER_MS = 1 / 100;
export const ROW_WIDTH = HOUR_MS * UNITS_PER_MS;
export const ROW_HEIGHT = 1000;

const BASELINE_STEP_MS = 30_000;
/** ±1.4% of a row: enough to read as ink, too little to mistake for an event. */
const NOISE = 14;
/** How far a burst reaches into the neighbouring rows before the pen hits its stop. */
const CLIP = 2.2 * ROW_HEIGHT;
const MAX_DURATION_MS = 12 * 60_000;

/**
 * Peak height of a burst. Real ground motion grows tenfold per magnitude step,
 * which would flatten everything below M4 into the noise and throw anything
 * above M5 off the page. This grows ~3.2x per step (the square root), and the
 * legend says so.
 */
export function burstAmplitude(magnitude: number): number {
  return Math.min(CLIP, Math.max(24, 36 * 10 ** (0.5 * (magnitude - 2))));
}

/** Larger ruptures shake for longer: from ~12 s for the smallest to 12 min at the top. */
export function burstDuration(magnitude: number): number {
  return Math.min(MAX_DURATION_MS, Math.max(12_000, 20_000 * 10 ** (0.3 * (magnitude - 2))));
}

interface Burst {
  readonly start: number;
  readonly end: number;
  readonly duration: number;
  readonly step: number;
  readonly amplitude: number;
  readonly seed: number;
  readonly highlighted: boolean;
}

function toBurst(event: TraceEvent): Burst {
  const magnitude = event.magnitude ?? 0;
  const duration = burstDuration(magnitude);
  return {
    start: event.time,
    end: event.time + duration,
    duration,
    // About 48 zigzags per burst, never finer than 1.5 s.
    step: Math.max(1_500, duration / 48),
    amplitude: burstAmplitude(magnitude),
    seed: seedOf(event.id),
    highlighted: event.highlighted,
  };
}

/** A small P arrival, the large S swing, then a long exponential coda. */
function envelope(tau: number): number {
  if (tau < 0.16) return 0.25 * Math.sqrt(tau / 0.16);
  if (tau < 0.26) return 0.25 + 0.75 * ((tau - 0.16) / 0.1);
  return Math.exp(-(tau - 0.26) * 4.5);
}

function burstAt(burst: Burst, time: number): number {
  if (time < burst.start || time >= burst.end) return 0;
  const phase = (time - burst.start) / burst.step;
  const jitter = 0.6 + 0.4 * hash01(burst.seed, Math.round(phase));
  // cos(πn) alternates ±1 on the burst's own samples: the dense zigzag of a drum record.
  return (
    burst.amplitude *
    envelope((time - burst.start) / burst.duration) *
    Math.cos(Math.PI * phase) *
    jitter
  );
}

function noiseAt(time: number): number {
  return (hash01(Math.floor(time / 1000), 0x51ed) * 2 - 1) * NOISE;
}

export function buildTrace(
  events: readonly TraceEvent[],
  now: number,
  hours = 24,
): readonly TraceRow[] {
  const lastStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  const firstStart = lastStart - (hours - 1) * HOUR_MS;
  const bursts = events
    .filter((event) => event.time >= firstStart - MAX_DURATION_MS && event.time <= now)
    .map(toBurst)
    .sort((a, b) => a.start - b.start);

  return Array.from({ length: hours }, (_, index) => {
    const start = firstStart + index * HOUR_MS;
    const end = Math.min(start + HOUR_MS, now);
    const overlapping = bursts.filter((burst) => burst.start <= end && burst.end >= start);
    return drawRow(start, end, index, overlapping);
  });
}

function drawRow(start: number, end: number, index: number, bursts: readonly Burst[]): TraceRow {
  const baseline = index * ROW_HEIGHT + ROW_HEIGHT / 2;

  const times: number[] = [];
  for (let time = start; time < end; time += BASELINE_STEP_MS) times.push(time);
  times.push(end);
  for (const burst of bursts) {
    for (let time = burst.start; time < burst.end; time += burst.step) {
      if (time >= start && time <= end) times.push(time);
    }
  }
  times.sort((a, b) => a - b);

  const points: Point[] = [];
  for (const time of times) {
    const x = Math.round((time - start) * UNITS_PER_MS);
    if (points.at(-1)?.x === x) continue;
    let displacement = noiseAt(time);
    for (const burst of bursts) displacement += burstAt(burst, time);
    const clipped = Math.max(-CLIP, Math.min(CLIP, displacement));
    points.push({ time, x, y: Math.round(baseline - clipped) });
  }

  const pen = bursts
    .filter((burst) => burst.highlighted)
    .map((burst) => points.filter((point) => point.time >= burst.start && point.time <= burst.end))
    .filter((segment) => segment.length > 1)
    .map(encode);

  return { start, ink: encode(points), pen };
}

interface Point {
  readonly time: number;
  readonly x: number;
  readonly y: number;
}

/** Relative commands on integer units: the SSR payload is dominated by these strings. */
function encode(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (!first) return '';
  let path = `M${first.x} ${first.y}l`;
  let previous = first;
  for (const point of rest) {
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    path += `${path.endsWith('l') ? '' : ' '}${dx}${dy < 0 ? '' : ' '}${dy}`;
    previous = point;
  }
  return path;
}

/** FNV-1a, so an event keeps the same wiggle across renders and machines. */
function seedOf(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Integer hash to [0, 1). Same result on the server and in every browser. */
function hash01(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4_294_967_296;
}
