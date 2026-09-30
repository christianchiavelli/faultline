import type { Params } from '@angular/router';
import { isDepthClass, type DepthClass } from '@shared/domain/depth';
import type { ReviewStatus } from '@shared/domain/quake';

/**
 * What the log shows, kept in the address bar rather than a store: a view can
 * be shared, bookmarked and undone with Back, and the server renders it as it
 * was asked for. Each parameter is named after what it sets and holds a word
 * or a number that reads on its own; a default is left out of the address.
 */
export interface LogQuery {
  /** `?mag=any` or `?mag=4.5`. */
  readonly magnitude: MagnitudeFloor;
  /** `?region=alaska`, as `regionSlug` writes it. */
  readonly region: string | null;
  /** `?depth=shallow`, `intermediate` or `deep`. */
  readonly depth: DepthClass | null;
  /** `?review=reviewed` or `automatic`. */
  readonly review: ReviewStatus | null;
  /** `?kind=earthquake`, or `other` for explosions, quarry blasts and the rest. */
  readonly kind: KindFilter | null;
  /** `?rows=all`: every event, not only the latest. */
  readonly unfolded: boolean;
}

/**
 * M2.5 by default: below it the log is mostly the dense micro-seismicity of a
 * few Californian and Alaskan networks, and the trace above already shows it.
 */
export const MAGNITUDE_FLOORS = [
  { value: 'any', label: 'Any', min: null },
  { value: '2.5', label: '2.5 and up', min: 2.5 },
  { value: '4.5', label: '4.5 and up', min: 4.5 },
] as const;

export type MagnitudeFloor = (typeof MAGNITUDE_FLOORS)[number]['value'];

export type KindFilter = 'earthquake' | 'other';

/** The query parameters, as the router binds them to the page. */
export interface LogParams {
  readonly mag?: string;
  readonly region?: string;
  readonly depth?: string;
  readonly review?: string;
  readonly kind?: string;
  readonly rows?: string;
}

export const DEFAULT_LOG_QUERY: LogQuery = {
  magnitude: '2.5',
  region: null,
  depth: null,
  review: null,
  kind: null,
  unfolded: false,
};

/** Lowercase words joined by hyphens, and short: anything else is not a region this app wrote. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Anything the log does not know, it reads as its default rather than failing the page. */
export function parseLogQuery(params: LogParams): LogQuery {
  const region = params.region?.toLowerCase();
  return {
    magnitude:
      MAGNITUDE_FLOORS.find((floor) => floor.value === params.mag)?.value ??
      DEFAULT_LOG_QUERY.magnitude,
    region: region && region.length <= 64 && SLUG.test(region) ? region : null,
    depth: isDepthClass(params.depth) ? params.depth : null,
    review: params.review === 'reviewed' || params.review === 'automatic' ? params.review : null,
    kind: params.kind === 'earthquake' || params.kind === 'other' ? params.kind : null,
    unfolded: params.rows === 'all',
  };
}

/**
 * The address of a view, always written in the same order, so that one view
 * has one address.
 */
export function logParams(query: LogQuery): Params {
  const params: Params = {};
  if (query.magnitude !== DEFAULT_LOG_QUERY.magnitude) params['mag'] = query.magnitude;
  if (query.region) params['region'] = query.region;
  if (query.depth) params['depth'] = query.depth;
  if (query.review) params['review'] = query.review;
  if (query.kind) params['kind'] = query.kind;
  if (query.unfolded) params['rows'] = 'all';
  return params;
}

/** Whether any filter differs from the default view. Unfolding is not a filter. */
export function isFiltered(query: LogQuery): boolean {
  return (
    query.magnitude !== DEFAULT_LOG_QUERY.magnitude ||
    query.region !== null ||
    query.depth !== null ||
    query.review !== null ||
    query.kind !== null
  );
}

/** The same view with every filter back at its default. */
export function clearFilters(query: LogQuery): LogQuery {
  return { ...DEFAULT_LOG_QUERY, unfolded: query.unfolded };
}

export function minimumMagnitude(floor: MagnitudeFloor): number | null {
  return MAGNITUDE_FLOORS.find((candidate) => candidate.value === floor)!.min;
}
