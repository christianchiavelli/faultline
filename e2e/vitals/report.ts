/**
 * What a measurement of the Web Vitals holds, how it is judged against the
 * baseline, and how it reads: in the run's summary on GitHub, and in the
 * README. Plain TypeScript with no imports of its own, so a script can load
 * it under plain `node` (see `scripts/accept-vitals.ts`).
 */
import { readFileSync } from 'node:fs';

/** The three Core Web Vitals, in the order a visit meets them. */
export const METRICS = ['LCP', 'CLS', 'INP'] as const;
export type Metric = (typeof METRICS)[number];

/** One metric of one visit, as web-vitals last reported it. */
export interface Reading {
  readonly value: number;
  /** What the number is about: the element painted, the one shifted, or the one interacted with. */
  readonly target?: string;
  /** Where its time went, in milliseconds, as web-vitals' attribution breaks it down. */
  readonly parts: Readonly<Record<string, number>>;
}

export type Measurement = Readonly<Record<Metric, Reading>>;

export interface Page {
  /** Its name in the baseline. */
  readonly key: string;
  readonly name: string;
  readonly path: string;
}

export interface PageResult extends Page {
  readonly visits: readonly Measurement[];
  /** Each metric's median over the visits: an odd number of them, so always one visit's own value. */
  readonly median: Readonly<Record<Metric, number>>;
}

export interface Baseline {
  /** The day it was measured, and the CI runs it was accepted from. */
  readonly measured?: string;
  readonly runs?: readonly string[];
  readonly pages: Readonly<Record<string, Omit<Page, 'key'> & Readonly<Record<Metric, number>>>>;
}

/** The name a page's result is attached under, for the reporter to find. */
export const ATTACHMENT = 'web-vitals';

/**
 * How far a median may rise over its baseline before the page counts as
 * worse: a share of the baseline, or a floor where that share is smaller than
 * the runner's own noise. GitHub's runners are not all the same machine: from
 * one to the next, the same commit moved LCP by 4% and INP by a fifth.
 */
export const TOLERANCE: Readonly<
  Record<Metric, { readonly share: number; readonly floor: number }>
> = {
  LCP: { share: 0.1, floor: 100 },
  // Layout does not depend on the machine's speed: a shift is a shift.
  CLS: { share: 0, floor: 0.01 },
  // The browser reports an interaction's duration in steps of 8 ms: two of them are noise.
  INP: { share: 0.3, floor: 16 },
};

export const limitOf = (metric: Metric, baseline: number): number =>
  baseline + Math.max(baseline * TOLERANCE[metric].share, TOLERANCE[metric].floor);

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function summarise(page: Page, visits: readonly Measurement[]): PageResult {
  const medians = METRICS.map((metric) => [metric, median(visits.map((v) => v[metric].value))]);
  return { ...page, visits, median: Object.fromEntries(medians) as Record<Metric, number> };
}

export function readBaseline(): Baseline {
  return JSON.parse(readFileSync(new URL('baseline.json', import.meta.url), 'utf8')) as Baseline;
}

/** A value as the baseline keeps it: milliseconds whole, a shift to four places. */
const rounded = (metric: Metric, value: number) =>
  metric === 'CLS' ? Math.round(value * 10_000) / 10_000 : Math.round(value);

const valuesOf = (metric: (metric: Metric) => number) =>
  Object.fromEntries(METRICS.map((m) => [m, rounded(m, metric(m))])) as Record<Metric, number>;

/** The measurement as a baseline, to be accepted as the next one: what `vitals-report/web-vitals.json` holds. */
export function asBaseline(pages: readonly PageResult[]): Baseline {
  return {
    measured: new Date().toISOString().slice(0, 10),
    pages: Object.fromEntries(
      pages.map(({ key, name, path, median }) => [
        key,
        { name, path, ...valuesOf((metric) => median[metric]) },
      ]),
    ),
  };
}

/** Measurements from several runs as one baseline: each metric's median across them, so no one runner sets it. */
export function mergeBaselines(
  measurements: readonly Baseline[],
  runs: readonly string[],
): Baseline {
  const [first] = measurements;
  return {
    measured: measurements
      .map(({ measured }) => measured ?? '')
      .sort()
      .at(-1),
    runs,
    pages: Object.fromEntries(
      Object.entries(first!.pages).map(([key, { name, path }]) => [
        key,
        {
          name,
          path,
          ...valuesOf((metric) => median(measurements.map((m) => m.pages[key]![metric]))),
        },
      ]),
    ),
  };
}

export function format(metric: Metric, value: number): string {
  if (metric === 'CLS') return value.toFixed(3);
  if (metric === 'LCP') return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

/** Whether a median is worse than its baseline by more than the tolerance; unknown without a baseline. */
export function isWorse(metric: Metric, value: number, baseline?: number): boolean | null {
  return baseline === undefined ? null : value > limitOf(metric, baseline);
}

/** A reading in words: what it is about, and where its time went. */
export function explain(metric: Metric, reading: Reading): string {
  const about = reading.target
    ? `\`${reading.target}\``
    : metric === 'CLS'
      ? 'no shift'
      : 'nothing';
  const parts = Object.entries(reading.parts).map(([part, ms]) => `${Math.round(ms)} ms ${part}`);
  return parts.length ? `${about}: ${parts.join(', ')}` : about;
}

/** The run's report: a table of the medians against the baseline, then what each number is about. */
export function summary(pages: readonly PageResult[], baseline: Baseline): string {
  const visits = pages[0]?.visits.length ?? 0;
  const cell = (page: PageResult, metric: Metric) => {
    const value = page.median[metric];
    const base = baseline.pages[page.key]?.[metric];
    const worse = isWorse(metric, value, base);
    if (worse === null) return `${format(metric, value)}, no baseline yet`;
    const against = `baseline ${format(metric, base!)}`;
    return worse
      ? `**${format(metric, value)}, worse than the ${against}**`
      : `${format(metric, value)}, ${against}`;
  };
  const range = (page: PageResult, metric: Metric) => {
    const values = page.visits.map((visit) => visit[metric].value);
    return `${format(metric, Math.min(...values))} to ${format(metric, Math.max(...values))}`;
  };
  const typical = (page: PageResult, metric: Metric) =>
    page.visits.find((visit) => visit[metric].value === page.median[metric])?.[metric];

  return [
    '## Web Vitals',
    '',
    `The median of ${visits} visits to each page, on the phone and connection of Lighthouse's mobile run: four times slower than the runner, on slow 4G.`,
    '',
    '| Page | LCP | CLS | INP |',
    '| --- | --- | --- | --- |',
    ...pages.map(
      (page) =>
        `| ${page.name}, \`${page.path}\` | ${METRICS.map((m) => cell(page, m)).join(' | ')} |`,
    ),
    ...pages.flatMap((page) => [
      '',
      `### ${page.name}`,
      '',
      ...METRICS.map((metric) => {
        const reading = typical(page, metric);
        const about = reading ? `, ${explain(metric, reading)}` : '';
        return `- **${metric}** ${format(metric, page.median[metric])}, from ${range(page, metric)}${about}`;
      }),
    ]),
    '',
  ].join('\n');
}

/** The README's table: the numbers of the baseline, which every run is held against. */
export function readmeTable(baseline: Baseline): string {
  const measured = baseline.measured
    ? new Date(baseline.measured).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'not yet';
  const runs = baseline.runs ?? [];
  const links = runs.map((url, i) => `[${i + 1}](${url})`).join(', ');
  const where =
    runs.length > 1
      ? `, the median of ${COUNTS[runs.length] ?? runs.length} runs in CI (${links})`
      : runs.length
        ? `, in [this run](${runs[0]})`
        : '';
  return [
    '| Page | LCP | CLS | INP |',
    '| --- | --- | --- | --- |',
    ...Object.values(baseline.pages).map(
      (page) => `| ${page.name} | ${METRICS.map((m) => format(m, page[m])).join(' | ')} |`,
    ),
    '',
    `Measured on ${measured}${where}.`,
  ].join('\n');
}

const COUNTS: Readonly<Record<number, string>> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
