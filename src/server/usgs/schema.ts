import { z } from 'zod';

/**
 * The USGS GeoJSON, validated at the boundary. Tolerant where the upstream is
 * loose (a new PAGER level degrades to `null` instead of failing the feed) and
 * strict where a wrong value would be drawn as fact (time, coordinates).
 *
 * https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */

export const featureSchema = z.object({
  type: z.literal('Feature'),
  id: z.string().min(1),
  properties: z.object({
    mag: z.number().nullable(),
    magType: z.string().nullable(),
    place: z.string().nullable(),
    time: z.number(),
    updated: z.number(),
    url: z.string(),
    felt: z.number().nullable(),
    alert: z.enum(['green', 'yellow', 'orange', 'red']).nullable().catch(null),
    status: z.string(),
    sig: z.number(),
    net: z.string(),
    type: z.string(),
  }),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.array(z.number().nullable()).min(2),
  }),
});

export type UsgsFeature = z.infer<typeof featureSchema>;

/**
 * Features stay `unknown` here and are parsed one by one, so that a single
 * malformed record costs one row instead of the whole feed.
 */
export const feedSchema = z.object({
  type: z.literal('FeatureCollection'),
  metadata: z.object({
    generated: z.number(),
    count: z.number(),
  }),
  features: z.array(z.unknown()),
});

const productSchema = z.object({
  source: z.string().optional(),
  preferredWeight: z.number().optional(),
  properties: z.record(z.string(), z.string()).optional(),
});

export type UsgsProduct = z.infer<typeof productSchema>;

/** `/count` answers `{ count, maxAllowed }`, with an `error` when the search would be refused. */
export const countSchema = z.object({ count: z.number().int().nonnegative() });

/** A CSV cell is empty when the value is unknown, and it stays unknown: never zero. */
const optionalNumber = z.string().transform((value, context) => {
  if (value.trim() === '') return null;
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  context.addIssue({ code: 'custom', message: `Not a number: ${value}` });
  return z.NEVER;
});

const requiredNumber = optionalNumber.pipe(z.number());
const optionalText = z.string().transform((value) => value.trim() || null);
const requiredText = z.string().trim().min(1);

/**
 * One row of a `format=csv` search, keyed by its header. Strict where a wrong
 * value would put an event in the wrong place or time, tolerant elsewhere.
 */
export const csvEventSchema = z.object({
  time: z.iso.datetime(),
  latitude: requiredNumber.pipe(z.number().min(-90).max(90)),
  longitude: requiredNumber.pipe(z.number().min(-180).max(180)),
  depth: optionalNumber,
  mag: optionalNumber,
  magType: optionalText,
  nst: optionalNumber,
  gap: optionalNumber,
  dmin: optionalNumber,
  rms: optionalNumber,
  net: requiredText,
  id: requiredText,
  updated: z.iso.datetime(),
  place: optionalText,
  type: requiredText,
  horizontalError: optionalNumber,
  depthError: optionalNumber,
  magError: optionalNumber,
  magNst: optionalNumber,
  status: requiredText,
  locationSource: optionalText,
  magSource: optionalText,
});

export type CsvEvent = z.infer<typeof csvEventSchema>;

/** The header a search must carry. Without one of these, every row would fail the same way. */
export const CSV_COLUMNS = Object.keys(csvEventSchema.shape) as readonly (keyof CsvEvent)[];

/** The FDSN event service answers `?eventid=` with a single Feature carrying its products. */
export const detailSchema = featureSchema.extend({
  properties: featureSchema.shape.properties.extend({
    products: z.record(z.string(), z.array(productSchema)).default({}),
  }),
});

export type UsgsDetail = z.infer<typeof detailSchema>;
