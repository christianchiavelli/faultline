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

/** The FDSN event service answers `?eventid=` with a single Feature carrying its products. */
export const detailSchema = featureSchema.extend({
  properties: featureSchema.shape.properties.extend({
    products: z.record(z.string(), z.array(productSchema)).default({}),
  }),
});

export type UsgsDetail = z.infer<typeof detailSchema>;
