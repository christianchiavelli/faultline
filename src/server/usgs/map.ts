import type { OriginQuality } from '@shared/api/contracts';
import type { Quake, QuakeSummary, ReviewStatus } from '@shared/domain/quake';
import type { UsgsFeature, UsgsProduct } from './schema';

/**
 * USGS feature to domain event. `null` means "do not show": the feature is
 * valid GeoJSON but not something to draw.
 */
export function toQuake(feature: UsgsFeature): Quake | null {
  const { properties: p, geometry } = feature;
  const [longitude, latitude, depth] = geometry.coordinates;

  if (p.status === 'deleted') return null;
  if (longitude == null || latitude == null) return null;

  return {
    id: feature.id,
    time: p.time,
    updated: p.updated,
    // A magnitude without its type cannot be read, so it is reported as missing.
    magnitude:
      p.mag !== null && p.magType !== null ? { value: p.mag, type: p.magType.toLowerCase() } : null,
    place: p.place?.trim() || null,
    location: { latitude, longitude, depthKm: depth ?? null },
    review: toReview(p.status),
    kind: p.type,
    network: p.net,
    felt: p.felt,
    alert: p.alert,
    significance: p.sig,
    url: p.url,
  };
}

/**
 * The list form of an event. Coordinates keep three decimals, about 110 m:
 * finer than that is noise next to the kilometres of location error on any
 * event in the feed, and it halves the bytes of the upstream floats.
 */
export function toSummary(quake: Quake): QuakeSummary {
  const { id, time, magnitude, place, location, review, kind } = quake;
  return {
    id,
    time,
    magnitude,
    place,
    location: {
      latitude: round(location.latitude, 3),
      longitude: round(location.longitude, 3),
      depthKm: location.depthKm === null ? null : round(location.depthKm, 2),
    },
    review,
    kind,
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Anything the USGS has not explicitly marked reviewed is treated as
 * automatic. Claiming a review that did not happen is the worse mistake.
 */
function toReview(status: string): ReviewStatus {
  return status === 'reviewed' ? 'reviewed' : 'automatic';
}

/** Several networks can publish an origin; the preferred one has the highest weight. */
export function preferredProduct(products: readonly UsgsProduct[] | undefined): UsgsProduct | null {
  if (!products?.length) return null;
  return products.reduce((best, product) =>
    (product.preferredWeight ?? 0) > (best.preferredWeight ?? 0) ? product : best,
  );
}

export function toOriginQuality(origin: UsgsProduct | null): OriginQuality | null {
  const props = origin?.properties;
  if (!props) return null;

  return {
    horizontalErrorKm: numberOrNull(props['horizontal-error']),
    depthErrorKm: numberOrNull(props['vertical-error']),
    stationsUsed: numberOrNull(props['num-stations-used']),
    azimuthalGapDeg: numberOrNull(props['azimuthal-gap']),
    depthType: props['depth-type'] ?? null,
  };
}

/** Product properties are all strings, and an absent measurement is sometimes an empty one. */
function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
