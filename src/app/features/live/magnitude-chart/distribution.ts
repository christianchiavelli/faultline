/**
 * The day's earthquakes by size, laid out on semi-log paper against the
 * Gutenberg–Richter law. Pure, so the server and the browser draw the same
 * chart.
 *
 * Positions are percentages of the plot: x across the magnitudes, y down from
 * the top of the count scale.
 */
import { expectedPerDay } from '@shared/domain/magnitude';
import { COMPLETE_WORLDWIDE_FROM, regionOf } from '@shared/domain/network';
import { isEarthquake, type QuakeSummary } from '@shared/domain/quake';

/** Half a magnitude: fine enough to show where the catalogue gives out, coarse enough for one day. */
export const STEP = 0.5;

/** Where the regional networks give out, and the global network has yet to begin. */
export const GAP = { from: 2.5, to: COMPLETE_WORLDWIDE_FROM } as const;

/** The count scale in powers of ten: one event in ten days up to ten thousand a day. */
const FLOOR = -1;
const TOP = 4;

export interface Bin {
  readonly from: number;
  readonly count: number;
  /** On an average day worldwide, by the law; `null` where that is off the top of the scale. */
  readonly expected: number | null;
  /** The centre of the bin, across. */
  readonly x: number;
  /** The top of its bar, down: the floor for an empty bin. */
  readonly y: number;
  /** A size the catalogue holds every one of, drawn in the pen. */
  readonly worldwide: boolean;
  /** Counted aloud, zero included, across the stretch the day or the law covers. */
  readonly labelled: boolean;
}

interface Line {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface Distribution {
  readonly from: number;
  readonly to: number;
  readonly bins: readonly Bin[];
  /** Of a bin, across, so a bar stands clear of its neighbours. */
  readonly barWidth: number;
  readonly magnitudes: readonly { readonly value: number; readonly x: number }[];
  readonly counts: readonly { readonly value: number; readonly y: number }[];
  readonly grid: {
    readonly across: readonly { readonly x: number; readonly major: boolean }[];
    readonly down: readonly { readonly y: number; readonly major: boolean }[];
  };
  /** Straight on this paper: from where the law enters at the top to where it leaves at the floor. */
  readonly law: Line;
  /** The stretch between the two kinds of network, under the law. */
  readonly gap: Line & {
    readonly located: number;
    readonly expected: number;
    /** The top of the tallest bar in its middle, where its label goes. */
    readonly peak: number;
  };
  readonly complete: number;
  /** The small events' hump, and the regions they come from. */
  readonly dense: {
    readonly x: number;
    readonly y: number;
    readonly regions: readonly string[];
  } | null;
}

export function distribution(quakes: readonly QuakeSummary[]): Distribution {
  const measured = quakes
    .filter(isEarthquake)
    .flatMap((quake) => (quake.magnitude ? [{ id: quake.id, value: quake.magnitude.value }] : []));

  // Whole magnitudes at both ends, wide enough for any day.
  const from = Math.min(-2, ...measured.map(({ value }) => Math.floor(value)));
  const to = Math.max(8, ...measured.map(({ value }) => Math.floor(value) + 1));
  const across = (magnitude: number) => ((magnitude - from) / (to - from)) * 100;
  const down = (count: number) => ((TOP - Math.log10(count)) / (TOP - FLOOR)) * 100;

  const counts = Array.from({ length: (to - from) / STEP }, () => 0);
  let [first, last] = [-1, -1];
  for (const { value } of measured) {
    const index = Math.floor((value - from) / STEP);
    counts[index] = (counts[index] ?? 0) + 1;
  }
  counts.forEach((count, index) => {
    if (count === 0) return;
    if (first < 0) first = index;
    last = index;
  });
  const bins = counts.map((count, index): Bin => {
    const start = from + index * STEP;
    const expected = expectedPerDay(start, start + STEP);
    return {
      from: start,
      count,
      expected: expected > 10 ** TOP ? null : expected,
      x: across(start + STEP / 2),
      y: count > 0 ? down(count) : 100,
      worldwide: start >= COMPLETE_WORLDWIDE_FROM,
      labelled:
        count > 0 || (first >= 0 && index > first && (index < last || expected >= 10 ** FLOOR)),
    };
  });

  // The law falls one power of ten per magnitude: a straight line, drawn through the bins' centres.
  const lawAt = (centre: number) => expectedPerDay(centre - STEP / 2, centre + STEP / 2);
  const reach = (count: number) => 5 + Math.log10(lawAt(5) / count);

  const inGap = bins.filter((bin) => bin.from >= GAP.from && bin.from < GAP.to);
  // The label sits over the gap's middle two bins, clear of the law above and the bars below.
  const middle = inGap.filter((bin) => bin.from >= GAP.from + STEP && bin.from < GAP.to - STEP);

  return {
    from,
    to,
    bins,
    barWidth: (STEP / (to - from)) * 100 * 0.4,
    magnitudes: Array.from({ length: to - from + 1 }, (_, i) => ({
      value: from + i,
      x: across(from + i),
    })),
    counts: Array.from({ length: TOP - FLOOR + 1 }, (_, i) => ({
      value: 10 ** (TOP - i),
      y: (i / (TOP - FLOOR)) * 100,
    })),
    grid: {
      across: Array.from({ length: (to - from) / STEP - 1 }, (_, i) => {
        const magnitude = from + (i + 1) * STEP;
        return { x: across(magnitude), major: Number.isInteger(magnitude) };
      }),
      // Semi-log paper: nine rules to each power of ten, crowding towards the next.
      down: Array.from({ length: TOP - FLOOR }, (_, decade) =>
        Array.from({ length: 9 }, (_, j) => ({
          y: down((j + 1) * 10 ** (FLOOR + decade)),
          major: j === 0,
        })),
      )
        .flat()
        .filter(({ y }) => y > 0 && y < 100),
    },
    law: {
      x1: across(reach(10 ** TOP)),
      y1: 0,
      x2: across(reach(10 ** FLOOR)),
      y2: 100,
    },
    gap: {
      x1: across(GAP.from),
      y1: down(lawAt(GAP.from)),
      x2: across(GAP.to),
      y2: down(lawAt(GAP.to)),
      located: inGap.reduce((sum, bin) => sum + bin.count, 0),
      expected: expectedPerDay(GAP.from, GAP.to),
      peak: Math.min(100, ...middle.map((bin) => bin.y)),
    },
    complete: across(COMPLETE_WORLDWIDE_FROM),
    dense: denseHump(bins, measured),
  };
}

/** The regional networks' events, below the gap: the tallest bin, and the three busiest regions. */
function denseHump(
  bins: readonly Bin[],
  measured: readonly { readonly id: string; readonly value: number }[],
): Distribution['dense'] {
  const tallest = bins
    .filter((bin) => bin.from < GAP.from && bin.count > 0)
    .reduce<Bin | null>((top, bin) => (!top || bin.count > top.count ? bin : top), null);
  if (!tallest) return null;

  const byRegion = new Map<string, number>();
  for (const { id, value } of measured) {
    const region = value < GAP.from ? regionOf(id) : null;
    if (region) byRegion.set(region, (byRegion.get(region) ?? 0) + 1);
  }
  const regions = [...byRegion]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([region]) => region);

  return regions.length ? { x: tallest.x, y: tallest.y, regions } : null;
}
