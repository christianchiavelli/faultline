import { formatDate } from '@angular/common';
import { EXPORT_LIMIT, type ExportFormat, type ExportQuery } from '@shared/api/export';
import type { QuakeSummary } from '@shared/domain/quake';

/**
 * Everything the export dialog decides, as plain functions: the choices it
 * offers, how a choice becomes a query, what to suggest when a query does not
 * fit in one file, and how to describe the result in words.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type PeriodChoice = 'day' | 'week' | 'month' | 'since-event' | 'custom';
export type MagnitudeChoice = 'all' | '2.5' | '4.5' | '6';
export type AreaChoice = 'world' | 'near';
export type RadiusChoice = '25' | '50' | '100' | '250' | '500';
export type ReviewChoice = 'any' | 'reviewed';
export type KindChoice = 'any' | 'earthquake';

/** What the dialog's controls hold. Radio values are strings, as the inputs carry them. */
export interface ExportForm {
  period: PeriodChoice;
  custom: { from: string; to: string };
  magnitude: MagnitudeChoice;
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
  /** "the M7.8 66 km NNW of Ende, Indonesia" */
  readonly description: string;
}

interface Choice<T> {
  readonly value: T;
  readonly label: string;
}

export function periodChoices(anchor: ExportAnchor | null): readonly Choice<PeriodChoice>[] {
  return [
    anchor
      ? { value: 'since-event', label: 'Since this event' }
      : { value: 'day', label: 'Last 24 hours' },
    { value: 'week', label: '7 days' },
    { value: 'month', label: '30 days' },
    { value: 'custom', label: 'Custom' },
  ];
}

export const MAGNITUDE_CHOICES: readonly Choice<MagnitudeChoice>[] = [
  { value: 'all', label: 'All' },
  { value: '2.5', label: '2.5+' },
  { value: '4.5', label: '4.5+' },
  { value: '6', label: '6+' },
];

export const RADIUS_CHOICES: readonly Choice<RadiusChoice>[] = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '250', label: '250' },
  { value: '500', label: '500 km' },
];

export const REVIEW_CHOICES: readonly Choice<ReviewChoice>[] = [
  { value: 'any', label: 'Reviewed and automatic' },
  { value: 'reviewed', label: 'Reviewed only' },
];

export const KIND_CHOICES: readonly Choice<KindChoice>[] = [
  { value: 'any', label: 'All seismic events' },
  { value: 'earthquake', label: 'Earthquakes only' },
];

export function toAnchor(quake: QuakeSummary): ExportAnchor {
  const magnitude = quake.magnitude ? `M${quake.magnitude.value.toFixed(1)} ` : '';
  return {
    time: quake.time,
    latitude: quake.location.latitude,
    longitude: quake.location.longitude,
    description: `the ${magnitude}${quake.place ?? 'event'}`,
  };
}

/**
 * The dialog opens on what the reader is already looking at: from the log,
 * the last day at the log's magnitude filter; from an event, every event near
 * it since it happened, which is its aftershock sequence.
 */
export function initialForm(
  anchor: ExportAnchor | null,
  magnitude: MagnitudeChoice,
  now: number,
): ExportForm {
  return {
    period: anchor ? 'since-event' : 'day',
    custom: { from: isoDay(now - 30 * DAY), to: isoDay(now) },
    magnitude: anchor ? 'all' : magnitude,
    area: anchor ? 'near' : 'world',
    radiusKm: '100',
    review: 'any',
    kind: 'any',
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
  return {
    from,
    to,
    minMagnitude: form.magnitude === 'all' ? null : Number(form.magnitude),
    near:
      form.area === 'near' && anchor
        ? {
            latitude: anchor.latitude,
            longitude: anchor.longitude,
            radiusKm: Number(form.radiusKm),
          }
        : null,
    reviewedOnly: form.review === 'reviewed',
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
): readonly Suggestion[] {
  const suggestions: Suggestion[] = [];

  const magnitude = NEXT_MAGNITUDE[form.magnitude];
  if (magnitude) suggestions.push({ label: `Only M${magnitude} and up`, change: { magnitude } });

  const shorter = shorterPeriod(form, query, count, anchor);
  if (shorter) suggestions.push(shorter);

  return suggestions;
}

function shorterPeriod(
  form: ExportForm,
  query: ExportQuery,
  count: number,
  anchor: ExportAnchor | null,
): Suggestion | null {
  const span = query.to - query.from;

  if (form.period === 'custom') {
    // Keep the end and move the start to where the count should fit, with a
    // margin, on the first of a month so the suggestion reads as a date.
    const fits = new Date(query.to - span * (EXPORT_LIMIT / count) * 0.9);
    const from = isoDay(Date.UTC(fits.getUTCFullYear(), fits.getUTCMonth() + 1, 1));
    if (from > form.custom.to) return null;
    return { label: `From ${formatDay(from)}`, change: { custom: { ...form.custom, from } } };
  }

  const offered = periodChoices(anchor).map((choice) => choice.value);
  const candidates: [PeriodChoice, number, string][] = [
    ['month', 30 * DAY, 'Only the last 30 days'],
    ['week', 7 * DAY, 'Only the last 7 days'],
    ['day', DAY, 'Only the last 24 hours'],
  ];
  const next = candidates.find(([period, length]) => offered.includes(period) && length < span);
  return next ? { label: next[2], change: { period: next[0] } } : null;
}

/** Measured on real exports: about 260 bytes an event as CSV, and 550 as GeoJSON. */
const BYTES_PER_EVENT: Record<ExportFormat, number> = { csv: 260, geojson: 550 };

export function estimateSize(count: number, format: ExportFormat): string {
  const bytes = count * BYTES_PER_EVENT[format];
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} kB`;
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}

/** "28 Sep, 19:31 to 29 Sep, 19:31 UTC", in whole days for a custom period. */
export function describePeriod(form: ExportForm, query: ExportQuery): string {
  if (form.period === 'custom')
    return `${formatDay(form.custom.from)} to ${formatDay(form.custom.to)}, UTC`;
  const from = formatDate(query.from, 'd MMM, HH:mm', 'en-US', 'UTC');
  if (form.period === 'since-event') return `${from} to now, UTC`;
  return `${from} to ${formatDate(query.to, 'd MMM, HH:mm', 'en-US', 'UTC')} UTC`;
}

/** "About 7 kB, worldwide, M2.5 and up": the file in one line, next to its count. */
export function describeFile(query: ExportQuery, count: number, format: ExportFormat): string {
  const where = query.near ? `within ${query.near.radiusKm} km of the epicentre` : 'worldwide';
  const magnitude =
    query.minMagnitude === null ? 'every magnitude' : `M${query.minMagnitude} and up`;
  return `About ${estimateSize(count, format)}, ${where}, ${magnitude}`;
}

export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function formatDay(day: string): string {
  return formatDate(`${day}T00:00:00Z`, 'd MMM yyyy', 'en-US', 'UTC');
}
