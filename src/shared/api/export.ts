import { z } from 'zod';

/**
 * The export contract. The BFF parses every request with `exportQuerySchema`,
 * the dialog builds its links with `exportSearchParams`, and both read their
 * limits from here, so the rules cannot drift apart.
 */

/** The most one export holds: about 26 MB as CSV, and five requests to the USGS. */
export const EXPORT_LIMIT = 100_000;

/** The instrumental record begins around here; the dialog offers nothing earlier. */
export const EXPORT_EARLIEST_DATE = '1900-01-01';

export const EXPORT_FORMATS = ['csv', 'geojson'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportQuery {
  /** Epoch milliseconds, inclusive. */
  readonly from: number;
  /** Epoch milliseconds, exclusive. */
  readonly to: number;
  readonly minMagnitude: number | null;
  /** A circle around a point, or the whole world. */
  readonly near: {
    readonly latitude: number;
    readonly longitude: number;
    readonly radiusKm: number;
  } | null;
  readonly reviewedOnly: boolean;
  readonly earthquakesOnly: boolean;
}

export interface ExportCount {
  readonly count: number;
  readonly limit: number;
}

/**
 * One row of an export. The names are the USGS's own, so a script written
 * against their CSV reads ours unchanged; `url` links each row to its record.
 */
export interface ExportEvent {
  readonly time: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly depth: number | null;
  readonly mag: number | null;
  readonly magType: string | null;
  readonly nst: number | null;
  readonly gap: number | null;
  readonly dmin: number | null;
  readonly rms: number | null;
  readonly net: string;
  readonly id: string;
  readonly updated: string;
  readonly place: string | null;
  readonly type: string;
  readonly horizontalError: number | null;
  readonly depthError: number | null;
  readonly magError: number | null;
  readonly magNst: number | null;
  readonly status: string;
  readonly locationSource: string | null;
  readonly magSource: string | null;
  readonly url: string;
}

/** Column order of the CSV, and property order of each GeoJSON feature. */
export const EXPORT_COLUMNS = [
  'time',
  'latitude',
  'longitude',
  'depth',
  'mag',
  'magType',
  'nst',
  'gap',
  'dmin',
  'rms',
  'net',
  'id',
  'updated',
  'place',
  'type',
  'horizontalError',
  'depthError',
  'magError',
  'magNst',
  'status',
  'locationSource',
  'magSource',
  'url',
] as const satisfies readonly (keyof ExportEvent)[];

/** ISO dates and times compare correctly as strings, so this holds for both. */
const inRecord = (iso: string) => iso >= EXPORT_EARLIEST_DATE;
const BEFORE_RECORD = 'The catalogue starts in 1900.';

/** A decimal as it arrives in a query string. Stricter than coercion, which reads "" as 0. */
const decimal = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'Expected a number.')
  .transform(Number);

const flag = z.literal('true').transform(() => true);

export const exportQuerySchema = z
  .object({
    from: z.iso
      .datetime({ message: 'Expected an ISO time in UTC.' })
      .refine(inRecord, BEFORE_RECORD),
    to: z.iso.datetime({ message: 'Expected an ISO time in UTC.' }),
    minmag: decimal.pipe(z.number().min(-2).max(10)).optional(),
    lat: decimal.pipe(z.number().min(-90).max(90)).optional(),
    lon: decimal.pipe(z.number().min(-180).max(180)).optional(),
    // Half the planet: the most the USGS accepts.
    radiuskm: decimal.pipe(z.number().positive().max(20_001.6)).optional(),
    reviewed: flag.optional(),
    earthquakes: flag.optional(),
  })
  // Zod runs a refinement even when a field already failed; an unreadable time is reported once, above.
  .refine((raw) => !(Date.parse(raw.from) >= Date.parse(raw.to)), {
    path: ['to'],
    message: 'The period must end after it starts.',
  })
  .refine(
    (raw) =>
      [raw.lat, raw.lon, raw.radiuskm].every((part) => part === undefined) ||
      [raw.lat, raw.lon, raw.radiuskm].every((part) => part !== undefined),
    { path: ['radiuskm'], message: 'A circle needs lat, lon and radiuskm together.' },
  )
  .transform((raw): ExportQuery => ({
    from: Date.parse(raw.from),
    to: Date.parse(raw.to),
    minMagnitude: raw.minmag ?? null,
    near:
      raw.lat !== undefined && raw.lon !== undefined && raw.radiuskm !== undefined
        ? { latitude: raw.lat, longitude: raw.lon, radiusKm: raw.radiuskm }
        : null,
    reviewedOnly: raw.reviewed ?? false,
    earthquakesOnly: raw.earthquakes ?? false,
  }));

export const exportFormatSchema = z.enum(EXPORT_FORMATS).default('csv');

/**
 * The dialog's custom period, as its two date fields hold it. Same floor as
 * the query, day by day instead of instant by instant.
 */
export const exportDateRangeSchema = z
  .object({
    from: z.iso.date({ message: 'Enter a date.' }).refine(inRecord, BEFORE_RECORD),
    to: z.iso.date({ message: 'Enter a date.' }),
  })
  .refine((range) => !isDay(range.from) || !isDay(range.to) || range.from <= range.to, {
    path: ['to'],
    message: 'End on or after the start.',
  });

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** The query as `/api/quakes/count` and `/api/quakes/export` read it back. */
export function exportSearchParams(query: ExportQuery): URLSearchParams {
  const params = new URLSearchParams({ from: isoTime(query.from), to: isoTime(query.to) });
  if (query.minMagnitude !== null) params.set('minmag', String(query.minMagnitude));
  if (query.near) {
    params.set('lat', String(query.near.latitude));
    params.set('lon', String(query.near.longitude));
    params.set('radiuskm', String(query.near.radiusKm));
  }
  if (query.reviewedOnly) params.set('reviewed', 'true');
  if (query.earthquakesOnly) params.set('earthquakes', 'true');
  return params;
}

/** `faultline_2026-08-30_2026-09-29_m2.5_100km.csv`: what and when, readable in a downloads folder. */
export function exportFileName(query: ExportQuery, format: ExportFormat): string {
  // `to` is exclusive, so the last day in the file is the one just before it.
  const parts = ['faultline', isoDay(query.from), isoDay(query.to - 1)];
  if (query.minMagnitude !== null) parts.push(`m${query.minMagnitude}`);
  if (query.near) parts.push(`${query.near.radiusKm}km`);
  return `${parts.join('_')}.${format}`;
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
