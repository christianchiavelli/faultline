import { formatDate } from '@angular/common';
import { depthName } from '@core/words/domain';
import {
  EXPORT_LIMIT,
  depthClassOfRange,
  type ExportFormat,
  type ExportQuery,
} from '@shared/api/export';
import { DEPTH_CLASSES, type DepthClass } from '@shared/domain/depth';
import type { QuakeSummary, ReviewStatus } from '@shared/domain/quake';
import { DATES } from '@ui/dates';
import { formatDecimal } from '@ui/numbers';

/**
 * Everything the export dialog decides, as plain functions: the choices it
 * offers, how a choice becomes a query, what to suggest when a query does not
 * fit in one file, and how to describe the result in words. A function that
 * writes a number or a date takes the page's `locale`.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type PeriodChoice = 'day' | 'week' | 'month' | 'since-event' | 'custom';
export type MagnitudeChoice = 'all' | '2.5' | '4.5' | '6';
export type AreaChoice = 'world' | 'near';
export type RadiusChoice = '25' | '50' | '100' | '250' | '500';
export type DepthChoice = 'any' | DepthClass;
export type ReviewChoice = 'any' | 'reviewed' | 'automatic';
export type KindChoice = 'any' | 'earthquake';

/** What the dialog's controls hold. Radio values are strings, as the inputs carry them. */
export interface ExportForm {
  period: PeriodChoice;
  custom: { from: string; to: string };
  magnitude: MagnitudeChoice;
  depth: DepthChoice;
  area: AreaChoice;
  radiusKm: RadiusChoice;
  review: ReviewChoice;
  kind: KindChoice;
  format: ExportFormat;
}

/** The event an export is centred on, when the dialog opens from that event's page. */
export interface ExportAnchor {
  readonly time: number;
  readonly latitude: number;
  readonly longitude: number;
  /** The event as a sentence names it: "the M7.8 66 km NNW of Ende, Indonesia". */
  readonly description: string;
}

/**
 * What the dialog starts from when the log opens it: the log's own filters,
 * as far as the catalogue can select by them.
 */
export interface ExportPreset {
  readonly magnitude: MagnitudeChoice;
  readonly depth: DepthChoice;
  readonly review: ReviewChoice;
  readonly kind: KindChoice;
  /** The log's filters the catalogue has no way to select by. */
  readonly leftOut: readonly LeftOutFilter[];
}

/** A filter of the log the USGS catalogue cannot select by: "other events" is every kind but one. */
export type LeftOutFilter = 'region' | 'search' | 'other-kinds';

export const DEFAULT_PRESET: ExportPreset = {
  magnitude: '2.5',
  depth: 'any',
  review: 'any',
  kind: 'any',
  leftOut: [],
};

interface Choice<T> {
  readonly value: T;
  readonly label: string;
}

export function periodChoices(anchor: ExportAnchor | null): readonly Choice<PeriodChoice>[] {
  return [
    anchor
      ? {
          value: 'since-event',
          label: $localize`:a period of the export, from the event it was opened from:Since this event`,
        }
      : { value: 'day', label: $localize`:a period of the export:Last 24 hours` },
    { value: 'week', label: $localize`:a period of the export:7 days` },
    { value: 'month', label: $localize`:a period of the export:30 days` },
    { value: 'custom', label: $localize`:a period of the export, between two dates:Custom` },
  ];
}

const MAGNITUDE_FLOORS: readonly MagnitudeChoice[] = ['2.5', '4.5', '6'];

/** "All", then "2.5+", "4.5+", "6+": "2,5+" in Portuguese. */
export function magnitudeChoices(locale: string): readonly Choice<MagnitudeChoice>[] {
  return [
    {
      value: 'all',
      label: $localize`:the export's choice of no magnitude floor, every magnitude:All`,
    },
    ...MAGNITUDE_FLOORS.map((value) => ({
      value,
      label: `${formatDecimal(Number(value), locale, '1.0-1')}+`,
    })),
  ];
}

export const DEPTH_CHOICES: readonly Choice<DepthChoice>[] = [
  { value: 'any', label: $localize`:filter option of the log that leaves its filter off:Any` },
  ...DEPTH_CLASSES.map(({ value }) => ({ value, label: depthName(value) })),
];

export const RADIUS_CHOICES: readonly Choice<RadiusChoice>[] = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '250', label: '250' },
  { value: '500', label: '500 km' },
];

export const REVIEW_CHOICES: readonly Choice<ReviewChoice>[] = [
  { value: 'any', label: $localize`:a review choice of the export:Reviewed and automatic` },
  { value: 'reviewed', label: $localize`:a review choice of the export:Reviewed only` },
  { value: 'automatic', label: $localize`:a review choice of the export:Automatic only` },
];

export const KIND_CHOICES: readonly Choice<KindChoice>[] = [
  { value: 'any', label: $localize`:a kind choice of the export:All seismic events` },
  { value: 'earthquake', label: $localize`:a kind choice of the export:Earthquakes only` },
];

export function toAnchor(quake: QuakeSummary, locale: string): ExportAnchor {
  const magnitude = quake.magnitude ? formatDecimal(quake.magnitude.value, locale, '1.1-1') : null;
  const place = quake.place;
  return {
    time: quake.time,
    latitude: quake.location.latitude,
    longitude: quake.location.longitude,
    description:
      magnitude && place
        ? $localize`:an event as a sentence names it, as in the M7.8 66 km NNW of Ende, Indonesia:the M${magnitude}:magnitude: ${place}:place:`
        : magnitude
          ? $localize`:an event as a sentence names it, with no place, as in the M7.8 event:the M${magnitude}:magnitude: event`
          : place
            ? $localize`:an event as a sentence names it, with no magnitude:the event ${place}:place:`
            : $localize`:an event as a sentence names it, with neither a magnitude nor a place:the event`,
  };
}

/**
 * The dialog opens on what the reader is already looking at: from the log,
 * the last day with the log's filters; from an event, every event near it
 * since it happened, which is its aftershock sequence.
 */
export function initialForm(
  anchor: ExportAnchor | null,
  preset: ExportPreset,
  now: number,
): ExportForm {
  return {
    period: anchor ? 'since-event' : 'day',
    custom: { from: isoDay(now - 30 * DAY), to: isoDay(now) },
    magnitude: anchor ? 'all' : preset.magnitude,
    depth: preset.depth,
    area: anchor ? 'near' : 'world',
    radiusKm: '100',
    review: preset.review,
    kind: preset.kind,
    format: 'csv',
  };
}

/**
 * The query for a filled-in form. Relative periods end at the next whole
 * minute, so a query, and the count cached for it, holds still between clock
 * ticks and still takes in the newest events.
 */
export function toQuery(form: ExportForm, anchor: ExportAnchor | null, now: number): ExportQuery {
  const end = Math.ceil(now / MINUTE) * MINUTE;
  const [from, to] = periodBounds(form, anchor, end);
  const depth = DEPTH_CLASSES.find((candidate) => candidate.value === form.depth);
  return {
    from,
    to,
    minMagnitude: form.magnitude === 'all' ? null : Number(form.magnitude),
    minDepthKm: depth?.fromKm ?? null,
    maxDepthKm: depth?.toKm ?? null,
    near:
      form.area === 'near' && anchor
        ? {
            latitude: anchor.latitude,
            longitude: anchor.longitude,
            radiusKm: Number(form.radiusKm),
          }
        : null,
    review: form.review === 'any' ? null : form.review,
    earthquakesOnly: form.kind === 'earthquake',
  };
}

function periodBounds(
  form: ExportForm,
  anchor: ExportAnchor | null,
  end: number,
): [number, number] {
  switch (form.period) {
    case 'day':
      return [end - DAY, end];
    case 'week':
      return [end - 7 * DAY, end];
    case 'month':
      return [end - 30 * DAY, end];
    case 'since-event':
      return [anchor?.time ?? end - DAY, end];
    case 'custom':
      // Whole days, the last one included.
      return [
        Date.parse(`${form.custom.from}T00:00:00Z`),
        Date.parse(`${form.custom.to}T00:00:00Z`) + DAY,
      ];
  }
}

export interface Suggestion {
  readonly label: string;
  readonly change: Partial<ExportForm>;
}

const NEXT_MAGNITUDE: Record<MagnitudeChoice, MagnitudeChoice | null> = {
  all: '2.5',
  '2.5': '4.5',
  '4.5': '6',
  '6': null,
};

/**
 * Two ways to fit a search that is too large: a higher magnitude floor, and a
 * shorter period. The dialog counts both and offers only those that fit, so
 * the reader is never sent from one refusal to another.
 */
export function suggestionsFor(
  form: ExportForm,
  query: ExportQuery,
  count: number,
  anchor: ExportAnchor | null,
  locale: string,
): readonly Suggestion[] {
  const suggestions: Suggestion[] = [];

  const magnitude = NEXT_MAGNITUDE[form.magnitude];
  if (magnitude) {
    const floor = formatDecimal(Number(magnitude), locale, '1.0-1');
    suggestions.push({
      label: $localize`:a suggestion that raises the export's magnitude floor, as in Only M4.5 and up:Only M${floor}:magnitude: and up`,
      change: { magnitude },
    });
  }

  const shorter = shorterPeriod(form, query, count, anchor, locale);
  if (shorter) suggestions.push(shorter);

  return suggestions;
}

function shorterPeriod(
  form: ExportForm,
  query: ExportQuery,
  count: number,
  anchor: ExportAnchor | null,
  locale: string,
): Suggestion | null {
  const span = query.to - query.from;

  if (form.period === 'custom') {
    // Keep the end and move the start to where the count should fit, with a
    // margin, on the first of a month so the suggestion reads as a date.
    const fits = new Date(query.to - span * (EXPORT_LIMIT / count) * 0.9);
    const from = isoDay(Date.UTC(fits.getUTCFullYear(), fits.getUTCMonth() + 1, 1));
    if (from > form.custom.to) return null;
    const day = formatDay(from, locale);
    return {
      label: $localize`:a suggestion that moves the start of the export's period, as in From 1 Dec 2013:From ${day}:day:`,
      change: { custom: { ...form.custom, from } },
    };
  }

  const offered = periodChoices(anchor).map((choice) => choice.value);
  const candidates: [PeriodChoice, number, string][] = [
    [
      'month',
      30 * DAY,
      $localize`:a suggestion that shortens the export's period:Only the last 30 days`,
    ],
    [
      'week',
      7 * DAY,
      $localize`:a suggestion that shortens the export's period:Only the last 7 days`,
    ],
    ['day', DAY, $localize`:a suggestion that shortens the export's period:Only the last 24 hours`],
  ];
  const next = candidates.find(([period, length]) => offered.includes(period) && length < span);
  return next ? { label: next[2], change: { period: next[0] } } : null;
}

/** Measured on real exports: about 260 bytes an event as CSV, and 550 as GeoJSON. */
const BYTES_PER_EVENT: Record<ExportFormat, number> = { csv: 260, geojson: 550 };

export function estimateSize(count: number, format: ExportFormat, locale: string): string {
  const bytes = count * BYTES_PER_EVENT[format];
  if (bytes < 1_000_000) {
    return `${formatDecimal(Math.max(1, Math.round(bytes / 1000)), locale, '1.0-0')} kB`;
  }
  const digits = bytes < 10_000_000 ? '1.1-1' : '1.0-0';
  return `${formatDecimal(bytes / 1_000_000, locale, digits)} MB`;
}

/** "28 Sep, 19:31 to 29 Sep, 19:31 UTC", in whole days for a custom period. */
export function describePeriod(form: ExportForm, query: ExportQuery, locale: string): string {
  if (form.period === 'custom') {
    const from = formatDay(form.custom.from, locale);
    const to = formatDay(form.custom.to, locale);
    return $localize`:the export's period, in whole days, as in 1 Sept 2026 to 29 Sept 2026, UTC:${from}:from: to ${to}:to:, UTC`;
  }
  const from = formatDate(query.from, DATES.dayAndTime, locale, 'UTC');
  if (form.period === 'since-event') {
    return $localize`:the export's period, from an event until now, as in 14 Aug, 21.58 to now, UTC:${from}:from: to now, UTC`;
  }
  const to = formatDate(query.to, DATES.dayAndTime, locale, 'UTC');
  return $localize`:the export's period, as in 28 Sept, 19.31 to 29 Sept, 19.31 UTC:${from}:from: to ${to}:to: UTC`;
}

/** The depth classes as the file's description lists them, lowercase in a line of other facts. */
const FILE_DEPTHS: Readonly<Record<DepthClass, string>> = {
  shallow: $localize`:the depth class of the events in an export, in a list of its other facts:shallow`,
  intermediate: $localize`:the depth class of the events in an export, in a list of its other facts:intermediate`,
  deep: $localize`:the depth class of the events in an export, in a list of its other facts:deep`,
};

const FILE_REVIEWS: Readonly<Record<ReviewStatus, string>> = {
  reviewed: $localize`:the review status of the events in an export, in a list of its other facts:reviewed`,
  automatic: $localize`:the review status of the events in an export, in a list of its other facts:automatic`,
};

/** "About 7 kB, worldwide, M2.5 and up, shallow": the file in one line, next to its count. */
export function describeFile(
  query: ExportQuery,
  count: number,
  format: ExportFormat,
  locale: string,
): string {
  const size = estimateSize(count, format, locale);
  const radius = query.near ? formatDecimal(query.near.radiusKm, locale, '1.0-0') : null;
  const floor =
    query.minMagnitude === null ? null : formatDecimal(query.minMagnitude, locale, '1.0-1');
  const depth = depthClassOfRange(query);
  return [
    $localize`:the size of an export's file, first in a list of its facts, as in About 7 kB:About ${size}:size:`,
    radius
      ? $localize`:where the events of an export are, in a list of its facts, as in within 100 km of the epicentre:within ${radius}:radius: km of the epicentre`
      : $localize`:where the events of an export are, in a list of its facts:worldwide`,
    floor
      ? $localize`:the magnitude floor of an export, in a list of its facts, as in M2.5 and up:M${floor}:magnitude: and up`
      : $localize`:the magnitude floor of an export when it has none, in a list of its facts:every magnitude`,
    depth && FILE_DEPTHS[depth],
    query.review && FILE_REVIEWS[query.review],
  ]
    .filter(Boolean)
    .join(', ');
}

/** The log's filters a file cannot keep, as a list names them. */
const LEFT_OUT: Readonly<Record<LeftOutFilter, string>> = {
  region: $localize`:a filter of the log an export cannot keep, in a list:the region`,
  search: $localize`:a filter of the log an export cannot keep, in a list:the place search`,
  'other-kinds': $localize`:a filter of the log an export cannot keep, in a list:other events alone`,
};

/** "Left in the log: the region and the place search." Nothing when the file takes every filter. */
export function describeLeftOut(leftOut: readonly LeftOutFilter[], locale: string): string | null {
  if (!leftOut.length) return null;
  const list = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    leftOut.map((filter) => LEFT_OUT[filter]),
  );
  return $localize`:note atop the export dialog, on the log's filters the file cannot keep:Left in the log: ${list}:filters:. The USGS catalogue cannot select events that way, so the file holds more than the log shows.`;
}

export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function formatDay(day: string, locale: string): string {
  return formatDate(`${day}T00:00:00Z`, DATES.date, locale, 'UTC');
}
